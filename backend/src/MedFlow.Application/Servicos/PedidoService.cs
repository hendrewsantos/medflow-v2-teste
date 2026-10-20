using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using MedFlow.Domain.Servicos;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

/// <summary>
/// UC04 Montar Box e confirmar pedido · UC05 Acompanhar · UC07 Separar e finalizar · UC15 Cancelar
/// (RF09–RF13, RF17, RN02–RN09, RN11–RN13).
/// </summary>
public sealed class PedidoService
{
    private readonly IAppDbContext _db;
    private readonly IRelogio _relogio;

    public PedidoService(IAppDbContext db, IRelogio relogio)
    {
        _db = db;
        _relogio = relogio;
    }

    /// <summary>Mostra se o estoque atende a Box antes da confirmação — não reserva nada.</summary>
    public async Task<SimulacaoDto> SimularAsync(UsuarioLogado u, IReadOnlyList<ItemBoxRequest> itens, CancellationToken ct = default)
    {
        var (_, necessidades, medicamentos) = await MontarTratamentoAsync(u.Id, 0, itens, ct);
        var validoAte = _relogio.Agora.Date.AddDays(Pedido.DiasCicloPadrao);
        var resultado = necessidades.Select(n =>
        {
            var m = medicamentos.First(x => x.Id == n.MedicamentoId);
            var disponivel = m.DisponivelAte(validoAte);
            return new DisponibilidadeItemDto(m.Id, m.Nome, n.Quantidade, disponivel, disponivel >= n.Quantidade);
        }).ToList();
        return new SimulacaoDto(resultado.All(i => i.Atende), resultado);
    }

    /// <summary>
    /// RN03 — a reserva acontece AQUI, na confirmação, e não na separação física.
    /// Tratamento, pedido, reservas e movimentações são gravados juntos: ou tudo, ou nada.
    /// </summary>
    public async Task<PedidoDto> ConfirmarAsync(UsuarioLogado u, ConfirmarPedidoRequest r, CancellationToken ct = default)
    {
        if (u.Perfil != PerfilUsuario.Paciente) throw new AcessoNegadoException("Somente pacientes confirmam pedidos.");
        var agora = _relogio.Agora;

        var receita = await _db.Receitas.FirstOrDefaultAsync(x => x.Id == r.ReceitaId, ct) ?? throw new NaoEncontradoException("Receita");
        if (receita.PacienteId != u.Id) throw new AcessoNegadoException("Esta receita pertence a outro paciente.");
        if (!receita.PodeSerUsadaEm(agora)) throw new DomainException("A receita informada foi recusada ou está vencida. Envie uma nova receita (RN02).");

        if (await _db.Pedidos.AnyAsync(p => p.PacienteId == u.Id && (p.Status == StatusPedido.Pendente || p.Status == StatusPedido.EmSeparacao), ct))
            throw new ConflitoException("Você já tem uma Box em preparação. Aguarde a finalização ou cancele o pedido pendente.");

        var (tratamento, necessidades, medicamentos) = await MontarTratamentoAsync(u.Id, receita.Id, r.Itens, ct);
        var pedido = new Pedido(u.Id, tratamento, receita.Id, r.EnderecoEntrega, agora);
        var movimentacoes = ReservaEstoqueFefo.Reservar(pedido, necessidades, medicamentos, u.Id, agora);

        // Fluxo de renovação: receita já aprovada e válida dispensa nova análise.
        if (receita.Status == StatusReceita.Aprovada)
            pedido.IniciarSeparacao(null, agora, "Receita já aprovada e dentro da validade: pedido segue direto para separação.");

        _db.Tratamentos.Add(tratamento);
        _db.Pedidos.Add(pedido);
        _db.Movimentacoes.AddRange(movimentacoes);
        await _db.SalvarAsync(ct);

        return await ObterAsync(u, pedido.Id, ct);
    }

    public async Task<IReadOnlyList<PedidoResumoDto>> ListarMeusAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        var pedidos = await _db.Pedidos.Include(p => p.Paciente).Include(p => p.Itens)
            .Where(p => p.PacienteId == u.Id).OrderByDescending(p => p.CriadoEm).ToListAsync(ct);
        return pedidos.Select(p => p.ParaResumo()).ToList();
    }

    public async Task<IReadOnlyList<PedidoResumoDto>> ListarOperacionalAsync(UsuarioLogado u, StatusPedido? status, CancellationToken ct = default)
    {
        if (!u.EhEquipe) throw new AcessoNegadoException();
        var query = _db.Pedidos.Include(p => p.Paciente).Include(p => p.Itens).AsQueryable();
        if (status.HasValue) query = query.Where(p => p.Status == status.Value);
        var pedidos = await query.OrderBy(p => p.CriadoEm).ToListAsync(ct);
        return pedidos.Select(p => p.ParaResumo()).ToList();
    }

    public async Task<PedidoDto> ObterAsync(UsuarioLogado u, int id, CancellationToken ct = default)
    {
        var pedido = await _db.PedidosCompletos().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NaoEncontradoException("Pedido");
        var podeVer = u.EhEquipe
            || pedido.PacienteId == u.Id
            || (u.Perfil == PerfilUsuario.Entregador && (pedido.Status == StatusPedido.AguardandoEntregador || pedido.Entregas.Any(e => e.EntregadorId == u.Id)));
        if (!podeVer) throw new AcessoNegadoException();
        return pedido.ParaDto();
    }

    public async Task<PedidoDto> CancelarAsync(UsuarioLogado u, int id, CancellationToken ct = default)
    {
        var pedido = await _db.PedidosCompletos().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NaoEncontradoException("Pedido");
        _db.Movimentacoes.AddRange(pedido.Cancelar(u.Id, _relogio.Agora));
        await _db.SalvarAsync(ct);
        return pedido.ParaDto();
    }

    /// <summary>RN06 — Box separada fisicamente: baixa definitiva e rótulo com lote/validade de cada item.</summary>
    public async Task<PedidoDto> FinalizarBoxAsync(UsuarioLogado u, int id, CancellationToken ct = default)
    {
        if (!u.EhEquipe) throw new AcessoNegadoException("Somente a equipe da farmácia finaliza a Box.");
        var pedido = await _db.PedidosCompletos().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NaoEncontradoException("Pedido");
        _db.Movimentacoes.AddRange(pedido.FinalizarBox(u.Id, _relogio.Agora));
        await _db.SalvarAsync(ct);
        return pedido.ParaDto();
    }

    private async Task<(Tratamento Tratamento, IReadOnlyList<NecessidadeMedicamento> Necessidades, List<Medicamento> Medicamentos)> MontarTratamentoAsync(
        int pacienteId, int receitaId, IReadOnlyList<ItemBoxRequest>? itens, CancellationToken ct)
    {
        new Validador()
            .Exigir(itens is { Count: > 0 }, "itens", "Adicione ao menos um medicamento à Box.")
            .Exigir(itens is null || itens.Select(i => i.MedicamentoId).Distinct().Count() == itens.Count, "itens", "Cada medicamento deve aparecer uma única vez — use vários horários para ele.")
            .Lancar();

        var ids = itens!.Select(i => i.MedicamentoId).ToList();
        var medicamentos = await _db.Medicamentos.Include(m => m.Lotes).Where(m => ids.Contains(m.Id)).ToListAsync(ct);
        if (medicamentos.Count != ids.Count) throw new NaoEncontradoException("Medicamento");

        var tratamento = new Tratamento(pacienteId, receitaId, _relogio.Agora);
        foreach (var item in itens!)
        {
            var medicamento = medicamentos.First(m => m.Id == item.MedicamentoId);
            if (item.Horarios is null || item.Horarios.Count == 0) throw new DomainException($"Defina ao menos um horário para {medicamento.Nome}.");
            foreach (var horario in item.Horarios) tratamento.AdicionarSache(medicamento, horario, item.DosePorHorario);
        }
        return (tratamento, tratamento.NecessidadesDoCiclo(Pedido.DiasCicloPadrao), medicamentos);
    }
}

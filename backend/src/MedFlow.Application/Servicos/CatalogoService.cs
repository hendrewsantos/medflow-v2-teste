using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

/// <summary>UC08 Gerenciar medicamentos e lotes · UC09 Monitorar alertas (RF07, RF08, RF14, RN05, RN10).</summary>
public sealed class CatalogoService
{
    public const int DiasAlertaValidade = 30;

    private readonly IAppDbContext _db;
    private readonly IRelogio _relogio;

    public CatalogoService(IAppDbContext db, IRelogio relogio)
    {
        _db = db;
        _relogio = relogio;
    }

    /// <summary>Catálogo com saldo disponível para um ciclo de 30 dias. Pacientes não veem itens de controle especial.</summary>
    public async Task<IReadOnlyList<MedicamentoDto>> ListarAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        var hoje = _relogio.Agora.Date;
        var query = _db.Medicamentos.Include(m => m.Lotes).Where(m => m.Ativo);
        if (!u.EhEquipe) query = query.Where(m => !m.ControleEspecial);
        var medicamentos = await query.OrderBy(m => m.Nome).ToListAsync(ct);
        return medicamentos.Select(m => m.ParaDto(hoje, hoje.AddDays(Pedido.DiasCicloPadrao))).ToList();
    }

    public async Task<MedicamentoDto> CriarAsync(UsuarioLogado u, MedicamentoRequest r, CancellationToken ct = default)
    {
        GarantirEquipe(u);
        if (await _db.Medicamentos.AnyAsync(m => m.Nome == r.Nome.Trim() && m.Concentracao == r.Concentracao.Trim(), ct))
            throw new ConflitoException("Este medicamento já está cadastrado.");
        var medicamento = new Medicamento(r.Nome, r.PrincipioAtivo, r.Concentracao, r.FormaFarmaceutica, r.Tarja, r.ControleEspecial, r.NivelMinimo);
        _db.Medicamentos.Add(medicamento);
        await _db.SaveChangesAsync(ct);
        var hoje = _relogio.Agora.Date;
        return medicamento.ParaDto(hoje, hoje.AddDays(Pedido.DiasCicloPadrao));
    }

    public async Task<MedicamentoDto> AtualizarAsync(UsuarioLogado u, int id, MedicamentoRequest r, CancellationToken ct = default)
    {
        GarantirEquipe(u);
        var medicamento = await _db.Medicamentos.Include(m => m.Lotes).FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new NaoEncontradoException("Medicamento");
        medicamento.Atualizar(r.Nome, r.PrincipioAtivo, r.Concentracao, r.FormaFarmaceutica, r.Tarja, r.ControleEspecial, r.NivelMinimo);
        await _db.SaveChangesAsync(ct);
        var hoje = _relogio.Agora.Date;
        return medicamento.ParaDto(hoje, hoje.AddDays(Pedido.DiasCicloPadrao));
    }

    public async Task<MedicamentoDto> RegistrarEntradaAsync(UsuarioLogado u, int medicamentoId, EntradaLoteRequest r, CancellationToken ct = default)
    {
        GarantirEquipe(u);
        var agora = _relogio.Agora;
        var medicamento = await _db.Medicamentos.Include(m => m.Lotes).FirstOrDefaultAsync(m => m.Id == medicamentoId, ct) ?? throw new NaoEncontradoException("Medicamento");
        var lote = medicamento.RegistrarEntrada(r.Numero, r.Fabricacao, r.Validade, r.Quantidade, agora);
        _db.Movimentacoes.Add(new MovimentacaoEstoque(lote, TipoMovimentacao.Entrada, r.Quantidade, null, u.Id, agora, $"Entrada do lote {lote.Numero}."));
        await _db.SalvarAsync(ct);
        return medicamento.ParaDto(agora.Date, agora.Date.AddDays(Pedido.DiasCicloPadrao));
    }

    public async Task<IReadOnlyList<MovimentacaoDto>> ListarMovimentacoesAsync(UsuarioLogado u, int? medicamentoId, CancellationToken ct = default)
    {
        GarantirEquipe(u);
        var query = _db.Movimentacoes.Include(m => m.Lote).ThenInclude(l => l!.Medicamento).AsQueryable();
        if (medicamentoId.HasValue) query = query.Where(m => m.Lote!.MedicamentoId == medicamentoId.Value);
        var lista = await query.OrderByDescending(m => m.Em).ThenByDescending(m => m.Id).Take(200).ToListAsync(ct);
        return lista.Select(m => new MovimentacaoDto(m.Id, m.Lote?.Medicamento?.Nome ?? "—", m.Lote?.Numero ?? "—", m.Tipo, m.Quantidade, m.PedidoId, m.Em, m.Observacao)).ToList();
    }

    /// <summary>RN05 e RN10 — estoque abaixo do mínimo, lotes vencendo em até 30 dias e lotes vencidos com saldo.</summary>
    public async Task<IReadOnlyList<AlertaDto>> ListarAlertasAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        GarantirEquipe(u);
        var hoje = _relogio.Agora.Date;
        var medicamentos = await _db.Medicamentos.Include(m => m.Lotes).Where(m => m.Ativo).ToListAsync(ct);
        var alertas = new List<AlertaDto>();
        foreach (var m in medicamentos)
        {
            if (m.AbaixoDoMinimo(hoje))
                alertas.Add(new AlertaDto("EstoqueMinimo", m.Nome, $"Disponível {m.DisponivelAte(hoje)} un. — mínimo {m.NivelMinimo} un. Programe reposição.", "alta"));
            foreach (var l in m.Lotes.Where(x => x.QuantidadeFisica > 0))
            {
                if (l.Vencido(hoje))
                    alertas.Add(new AlertaDto("LoteVencido", m.Nome, $"Lote {l.Numero} venceu em {l.Validade:dd/MM/yyyy} com {l.QuantidadeFisica} un. Segregar para descarte.", "alta"));
                else if (l.VenceEmAte(hoje, DiasAlertaValidade))
                    alertas.Add(new AlertaDto("ValidadeProxima", m.Nome, $"Lote {l.Numero} vence em {l.Validade:dd/MM/yyyy} ({l.QuantidadeFisica} un.).", "media"));
            }
        }
        return alertas.OrderBy(a => a.Severidade == "alta" ? 0 : 1).ThenBy(a => a.Medicamento).ToList();
    }

    private static void GarantirEquipe(UsuarioLogado u)
    {
        if (!u.EhEquipe) throw new AcessoNegadoException();
    }
}

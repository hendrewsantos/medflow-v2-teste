using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

/// <summary>UC10 Iniciar rota · UC11 Confirmar entrega ou registrar ocorrência (RF15, RF16, RN14).</summary>
public sealed class EntregaService
{
    private readonly IAppDbContext _db;
    private readonly IRelogio _relogio;

    public EntregaService(IAppDbContext db, IRelogio relogio)
    {
        _db = db;
        _relogio = relogio;
    }

    public async Task<IReadOnlyList<PedidoDto>> ListarDisponiveisAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        GarantirEntregador(u);
        var pedidos = await _db.PedidosCompletos().Where(p => p.Status == StatusPedido.AguardandoEntregador).OrderBy(p => p.AtualizadoEm).ToListAsync(ct);
        return pedidos.Select(p => p.ParaDto()).ToList();
    }

    public async Task<IReadOnlyList<PedidoDto>> ListarMinhasAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        GarantirEntregador(u);
        var pedidos = await _db.PedidosCompletos().Where(p => p.Entregas.Any(e => e.EntregadorId == u.Id))
            .OrderByDescending(p => p.AtualizadoEm).Take(50).ToListAsync(ct);
        return pedidos.Select(p => p.ParaDto()).ToList();
    }

    public Task<PedidoDto> IniciarRotaAsync(UsuarioLogado u, int pedidoId, CancellationToken ct = default) =>
        Executar(u, pedidoId, p => p.IniciarRota(u.Id, _relogio.Agora), ct);

    public Task<PedidoDto> ConfirmarAsync(UsuarioLogado u, int pedidoId, ConfirmarEntregaRequest r, CancellationToken ct = default) =>
        Executar(u, pedidoId, p => p.ConfirmarEntrega(u.Id, r.Recebedor, _relogio.Agora), ct);

    public Task<PedidoDto> RegistrarOcorrenciaAsync(UsuarioLogado u, int pedidoId, OcorrenciaRequest r, CancellationToken ct = default) =>
        Executar(u, pedidoId, p => p.RegistrarOcorrencia(u.Id, r.Motivo, _relogio.Agora), ct);

    private async Task<PedidoDto> Executar(UsuarioLogado u, int pedidoId, Action<Pedido> acao, CancellationToken ct)
    {
        GarantirEntregador(u);
        var pedido = await _db.PedidosCompletos().FirstOrDefaultAsync(p => p.Id == pedidoId, ct) ?? throw new NaoEncontradoException("Pedido");
        acao(pedido);
        await _db.SaveChangesAsync(ct);
        return pedido.ParaDto();
    }

    private static void GarantirEntregador(UsuarioLogado u)
    {
        if (u.Perfil != PerfilUsuario.Entregador) throw new AcessoNegadoException("Somente entregadores acessam as rotas.");
    }
}

using MedFlow.Api.Seguranca;
using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using MedFlow.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

[Route("api/pedidos")]
public sealed class PedidosController : BaseController
{
    private readonly PedidoService _pedidos;
    public PedidosController(PedidoService pedidos) => _pedidos = pedidos;

    /// <summary>Confere a disponibilidade da Box antes de confirmar (não reserva).</summary>
    [HttpPost("simular")]
    [Authorize(Policy = Politicas.Paciente)]
    public async Task<ActionResult<SimulacaoDto>> Simular(IReadOnlyList<ItemBoxRequest> itens, CancellationToken ct) =>
        Ok(await _pedidos.SimularAsync(Logado, itens, ct));

    /// <summary>UC04 — confirma o pedido e reserva o estoque na mesma transação (RN03). 409 se faltar saldo.</summary>
    [HttpPost]
    [Authorize(Policy = Politicas.Paciente)]
    public async Task<ActionResult<PedidoDto>> Confirmar(ConfirmarPedidoRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await _pedidos.ConfirmarAsync(Logado, request, ct));

    [HttpGet("meus")]
    [Authorize(Policy = Politicas.Paciente)]
    public async Task<ActionResult<IReadOnlyList<PedidoResumoDto>>> Meus(CancellationToken ct) => Ok(await _pedidos.ListarMeusAsync(Logado, ct));

    [HttpGet]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<IReadOnlyList<PedidoResumoDto>>> Operacional([FromQuery] StatusPedido? status, CancellationToken ct) =>
        Ok(await _pedidos.ListarOperacionalAsync(Logado, status, ct));

    /// <summary>UC05 — detalhes e linha do tempo do pedido.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PedidoDto>> Obter(int id, CancellationToken ct) => Ok(await _pedidos.ObterAsync(Logado, id, ct));

    /// <summary>UC15 — cancelamento pelo paciente (somente Pendente); a reserva volta ao estoque.</summary>
    [HttpPost("{id:int}/cancelar")]
    [Authorize(Policy = Politicas.Paciente)]
    public async Task<ActionResult<PedidoDto>> Cancelar(int id, CancellationToken ct) => Ok(await _pedidos.CancelarAsync(Logado, id, ct));

    /// <summary>UC07 — Box separada fisicamente: baixa definitiva no estoque.</summary>
    [HttpPost("{id:int}/finalizar-box")]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<PedidoDto>> FinalizarBox(int id, CancellationToken ct) => Ok(await _pedidos.FinalizarBoxAsync(Logado, id, ct));
}

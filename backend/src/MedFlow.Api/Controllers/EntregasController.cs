using MedFlow.Api.Seguranca;
using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

[Route("api/entregas")]
[Authorize(Policy = Politicas.Entregador)]
public sealed class EntregasController : BaseController
{
    private readonly EntregaService _entregas;
    public EntregasController(EntregaService entregas) => _entregas = entregas;

    [HttpGet("disponiveis")]
    public async Task<ActionResult<IReadOnlyList<PedidoDto>>> Disponiveis(CancellationToken ct) => Ok(await _entregas.ListarDisponiveisAsync(Logado, ct));

    [HttpGet("minhas")]
    public async Task<ActionResult<IReadOnlyList<PedidoDto>>> Minhas(CancellationToken ct) => Ok(await _entregas.ListarMinhasAsync(Logado, ct));

    /// <summary>UC10 — inicia a rota.</summary>
    [HttpPost("{pedidoId:int}/iniciar")]
    public async Task<ActionResult<PedidoDto>> Iniciar(int pedidoId, CancellationToken ct) => Ok(await _entregas.IniciarRotaAsync(Logado, pedidoId, ct));

    /// <summary>UC11 — confirma a entrega com o nome de quem recebeu.</summary>
    [HttpPost("{pedidoId:int}/confirmar")]
    public async Task<ActionResult<PedidoDto>> Confirmar(int pedidoId, ConfirmarEntregaRequest request, CancellationToken ct) =>
        Ok(await _entregas.ConfirmarAsync(Logado, pedidoId, request, ct));

    /// <summary>UC11 (alternativo) — ocorrência: o pedido volta para a fila de entrega.</summary>
    [HttpPost("{pedidoId:int}/ocorrencia")]
    public async Task<ActionResult<PedidoDto>> Ocorrencia(int pedidoId, OcorrenciaRequest request, CancellationToken ct) =>
        Ok(await _entregas.RegistrarOcorrenciaAsync(Logado, pedidoId, request, ct));
}

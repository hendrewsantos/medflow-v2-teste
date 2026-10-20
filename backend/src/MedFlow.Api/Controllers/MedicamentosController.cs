using MedFlow.Api.Seguranca;
using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

[Route("api/medicamentos")]
public sealed class MedicamentosController : BaseController
{
    private readonly CatalogoService _catalogo;
    public MedicamentosController(CatalogoService catalogo) => _catalogo = catalogo;

    /// <summary>Catálogo com saldo disponível para o ciclo. Pacientes não veem itens de controle especial.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MedicamentoDto>>> Listar(CancellationToken ct) => Ok(await _catalogo.ListarAsync(Logado, ct));

    [HttpPost]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<MedicamentoDto>> Criar(MedicamentoRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await _catalogo.CriarAsync(Logado, request, ct));

    [HttpPut("{id:int}")]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<MedicamentoDto>> Atualizar(int id, MedicamentoRequest request, CancellationToken ct) =>
        Ok(await _catalogo.AtualizarAsync(Logado, id, request, ct));

    /// <summary>UC08 — entrada de lote (número, fabricação, validade e quantidade).</summary>
    [HttpPost("{id:int}/lotes")]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<MedicamentoDto>> RegistrarEntrada(int id, EntradaLoteRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await _catalogo.RegistrarEntradaAsync(Logado, id, request, ct));

    [HttpGet("movimentacoes")]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<IReadOnlyList<MovimentacaoDto>>> Movimentacoes([FromQuery] int? medicamentoId, CancellationToken ct) =>
        Ok(await _catalogo.ListarMovimentacoesAsync(Logado, medicamentoId, ct));

    /// <summary>UC09 — estoque abaixo do mínimo, validade próxima e lotes vencidos.</summary>
    [HttpGet("alertas")]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<IReadOnlyList<AlertaDto>>> Alertas(CancellationToken ct) => Ok(await _catalogo.ListarAlertasAsync(Logado, ct));
}

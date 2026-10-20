using MedFlow.Api.Seguranca;
using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

[Route("api/receitas")]
public sealed class ReceitasController : BaseController
{
    private readonly ReceitaService _receitas;
    public ReceitasController(ReceitaService receitas) => _receitas = receitas;

    /// <summary>UC03 — envio da receita (PDF, PNG ou JPG até 10 MB) com consentimento específico para dados de saúde.</summary>
    [HttpPost]
    [Authorize(Policy = Politicas.Paciente)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<ActionResult<ReceitaDto>> Enviar(IFormFile arquivo, [FromForm] bool consentimentoSaude, CancellationToken ct)
    {
        using var memoria = new MemoryStream();
        await arquivo.CopyToAsync(memoria, ct);
        var receita = await _receitas.EnviarAsync(Logado, memoria.ToArray(), arquivo.FileName, consentimentoSaude, ct);
        return StatusCode(StatusCodes.Status201Created, receita);
    }

    [HttpGet("minhas")]
    [Authorize(Policy = Politicas.Paciente)]
    public async Task<ActionResult<IReadOnlyList<ReceitaDto>>> Minhas(CancellationToken ct) => Ok(await _receitas.ListarMinhasAsync(Logado, ct));

    /// <summary>UC06 — fila de análise do farmacêutico.</summary>
    [HttpGet("pendentes")]
    [Authorize(Policy = Politicas.Farmaceutico)]
    public async Task<ActionResult<IReadOnlyList<ReceitaDto>>> Pendentes(CancellationToken ct) => Ok(await _receitas.ListarPendentesAsync(Logado, ct));

    [HttpGet("{id:int}/arquivo")]
    public async Task<IActionResult> Arquivo(int id, CancellationToken ct)
    {
        var (conteudo, tipo, nome) = await _receitas.ObterArquivoAsync(Logado, id, ct);
        return File(conteudo, tipo, nome);
    }

    [HttpPost("{id:int}/aprovar")]
    [Authorize(Policy = Politicas.Farmaceutico)]
    public async Task<ActionResult<ReceitaDto>> Aprovar(int id, AprovarReceitaRequest request, CancellationToken ct) =>
        Ok(await _receitas.AprovarAsync(Logado, id, request, ct));

    [HttpPost("{id:int}/recusar")]
    [Authorize(Policy = Politicas.Farmaceutico)]
    public async Task<ActionResult<ReceitaDto>> Recusar(int id, RecusarReceitaRequest request, CancellationToken ct) =>
        Ok(await _receitas.RecusarAsync(Logado, id, request, ct));
}

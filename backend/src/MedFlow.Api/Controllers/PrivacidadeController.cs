using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

/// <summary>UC12 — direitos do titular (LGPD art. 18): acesso, portabilidade, correção e eliminação.</summary>
[Route("api/privacidade")]
public sealed class PrivacidadeController : BaseController
{
    private readonly PrivacidadeService _privacidade;
    public PrivacidadeController(PrivacidadeService privacidade) => _privacidade = privacidade;

    [HttpGet("meus-dados")]
    public async Task<ActionResult<MeusDadosDto>> MeusDados(CancellationToken ct) => Ok(await _privacidade.ObterAsync(Logado, ct));

    /// <summary>Portabilidade: o mesmo conteúdo, como arquivo JSON para download.</summary>
    [HttpGet("meus-dados/exportar")]
    public async Task<IActionResult> Exportar(CancellationToken ct)
    {
        var dados = await _privacidade.ObterAsync(Logado, ct);
        var json = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(dados, new System.Text.Json.JsonSerializerOptions { WriteIndented = true, Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } });
        return File(json, "application/json", "meus-dados-medflow.json");
    }

    [HttpPut("meus-dados")]
    public async Task<ActionResult<MeusDadosDto>> Atualizar(AtualizarMeusDadosRequest request, CancellationToken ct) =>
        Ok(await _privacidade.AtualizarAsync(Logado, request, ct));

    [HttpDelete("minha-conta")]
    public async Task<IActionResult> Excluir(CancellationToken ct)
    {
        await _privacidade.ExcluirContaAsync(Logado, ct);
        return NoContent();
    }
}

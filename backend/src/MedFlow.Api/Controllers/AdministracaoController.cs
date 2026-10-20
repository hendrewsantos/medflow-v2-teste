using MedFlow.Api.Seguranca;
using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

[Route("api")]
public sealed class AdministracaoController : BaseController
{
    private readonly UsuarioService _usuarios;
    private readonly PainelService _painel;

    public AdministracaoController(UsuarioService usuarios, PainelService painel)
    {
        _usuarios = usuarios;
        _painel = painel;
    }

    /// <summary>UC14 — indicadores de resultado (tempo de ciclo P90, 1ª tentativa, pedidos parados...).</summary>
    [HttpGet("painel")]
    [Authorize(Policy = Politicas.Equipe)]
    public async Task<ActionResult<IndicadoresDto>> Painel(CancellationToken ct) => Ok(await _painel.ObterAsync(Logado, ct));

    /// <summary>UC13 — usuários (CPF sempre mascarado; o hash da senha nunca é retornado).</summary>
    [HttpGet("usuarios")]
    [Authorize(Policy = Politicas.Farmaceutico)]
    public async Task<ActionResult<IReadOnlyList<UsuarioResumo>>> Usuarios(CancellationToken ct) => Ok(await _usuarios.ListarAsync(Logado, ct));

    [HttpPost("usuarios")]
    [Authorize(Policy = Politicas.Farmaceutico)]
    public async Task<ActionResult<UsuarioResumo>> CriarUsuario(CriarUsuarioInternoRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await _usuarios.CriarInternoAsync(Logado, request, ct));

    [HttpPatch("usuarios/{id:int}/ativo")]
    [Authorize(Policy = Politicas.Farmaceutico)]
    public async Task<ActionResult<UsuarioResumo>> DefinirAtivo(int id, [FromQuery] bool valor, CancellationToken ct) =>
        Ok(await _usuarios.DefinirAtivoAsync(Logado, id, valor, ct));
}

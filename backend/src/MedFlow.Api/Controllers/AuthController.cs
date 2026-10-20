using MedFlow.Application.Dtos;
using MedFlow.Application.Servicos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MedFlow.Api.Controllers;

[Route("api/auth")]
public sealed class AuthController : BaseController
{
    private readonly AuthService _auth;
    public AuthController(AuthService auth) => _auth = auth;

    /// <summary>UC01 — cadastro do paciente com aceite dos termos (LGPD art. 7º, I).</summary>
    [HttpPost("cadastro")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<AuthResponse>> Cadastrar(CadastroPacienteRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await _auth.CadastrarPacienteAsync(request, ct));

    /// <summary>UC02 — login; devolve o JWT com o perfil do usuário.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct) =>
        Ok(await _auth.LoginAsync(request, ct));

    [HttpGet("eu")]
    public async Task<ActionResult<UsuarioResumo>> Eu(CancellationToken ct) => Ok(await _auth.ObterAsync(Logado, ct));
}

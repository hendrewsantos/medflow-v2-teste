using MedFlow.Api.Seguranca;
using MedFlow.Application.Abstracoes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Controllers;

/// <summary>Todos os endpoints exigem token JWT, salvo os marcados com [AllowAnonymous].</summary>
[ApiController]
[Authorize]
[Produces("application/json")]
public abstract class BaseController : ControllerBase
{
    protected UsuarioLogado Logado => User.ParaUsuarioLogado();
}

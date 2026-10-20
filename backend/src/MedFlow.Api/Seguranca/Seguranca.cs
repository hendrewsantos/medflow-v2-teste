using System.Security.Claims;
using MedFlow.Application.Abstracoes;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Comum;
using MedFlow.Domain.Enums;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace MedFlow.Api.Seguranca;

public static class Politicas
{
    public const string Paciente = "Paciente";
    public const string Farmaceutico = "Farmaceutico";
    public const string Equipe = "Equipe";
    public const string Entregador = "Entregador";
}

public static class ClaimsExtensions
{
    /// <summary>Identidade vem SEMPRE do token assinado — nunca de um cabeçalho enviado pelo navegador (ex.: X-User-Id).</summary>
    public static UsuarioLogado ParaUsuarioLogado(this ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var perfil = user.FindFirstValue(ClaimTypes.Role);
        if (!int.TryParse(id, out var usuarioId) || !Enum.TryParse<PerfilUsuario>(perfil, out var p))
            throw new CredenciaisInvalidasException();
        return new UsuarioLogado(usuarioId, p);
    }
}

/// <summary>Converte exceções em respostas ProblemDetails (RFC 7807) com o código HTTP correto.</summary>
public sealed class TratadorDeExcecoes : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly ILogger<TratadorDeExcecoes> _logger;

    public TratadorDeExcecoes(IProblemDetailsService problemDetails, ILogger<TratadorDeExcecoes> logger)
    {
        _problemDetails = problemDetails;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext contexto, Exception excecao, CancellationToken ct)
    {
        var (status, titulo) = excecao switch
        {
            ValidacaoException => (StatusCodes.Status400BadRequest, "Dados inválidos"),
            CredenciaisInvalidasException => (StatusCodes.Status401Unauthorized, "Não autenticado"),
            AcessoNegadoException => (StatusCodes.Status403Forbidden, "Acesso negado"),
            OperacaoNaoAutorizadaException => (StatusCodes.Status403Forbidden, "Acesso negado"),
            NaoEncontradoException => (StatusCodes.Status404NotFound, "Não encontrado"),
            ConflitoException => (StatusCodes.Status409Conflict, "Conflito"),
            TransicaoInvalidaException => (StatusCodes.Status409Conflict, "Transição de status não permitida"),
            EstoqueInsuficienteException => (StatusCodes.Status409Conflict, "Estoque insuficiente"),
            ContaBloqueadaException => (StatusCodes.Status423Locked, "Conta bloqueada"),
            DomainException => (StatusCodes.Status422UnprocessableEntity, "Regra de negócio"),
            _ => (StatusCodes.Status500InternalServerError, "Erro interno"),
        };

        if (status == StatusCodes.Status500InternalServerError)
            _logger.LogError(excecao, "Erro não tratado em {Caminho}", contexto.Request.Path);

        var detalhes = new ProblemDetails
        {
            Status = status,
            Title = titulo,
            // Mensagens de erro interno não expõem detalhes técnicos (RNF12).
            Detail = status == StatusCodes.Status500InternalServerError ? "Ocorreu um erro inesperado. Tente novamente." : excecao.Message,
        };
        if (excecao is ValidacaoException v) detalhes.Extensions["erros"] = v.Erros;
        if (excecao is EstoqueInsuficienteException e) detalhes.Extensions["faltas"] = e.Faltas;

        contexto.Response.StatusCode = status;
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = contexto, ProblemDetails = detalhes, Exception = excecao });
    }
}

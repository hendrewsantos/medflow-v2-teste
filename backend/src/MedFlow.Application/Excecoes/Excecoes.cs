namespace MedFlow.Application.Excecoes;

public abstract class AppException : Exception
{
    protected AppException(string mensagem) : base(mensagem) { }
}

/// <summary>HTTP 400 — dados de entrada inválidos.</summary>
public sealed class ValidacaoException : AppException
{
    public IReadOnlyDictionary<string, string[]> Erros { get; }

    public ValidacaoException(IReadOnlyDictionary<string, string[]> erros)
        : base("Um ou mais campos estão inválidos.") => Erros = erros;

    public ValidacaoException(string campo, string erro) : this(new Dictionary<string, string[]> { [campo] = new[] { erro } }) { }
}

/// <summary>HTTP 401 — mensagem genérica para não revelar se o e-mail existe.</summary>
public sealed class CredenciaisInvalidasException : AppException
{
    public CredenciaisInvalidasException() : base("E-mail ou senha incorretos.") { }
}

/// <summary>HTTP 423 — conta bloqueada temporariamente (RN17).</summary>
public sealed class ContaBloqueadaException : AppException
{
    public ContaBloqueadaException(DateTime ate) : base($"Conta bloqueada por excesso de tentativas. Tente novamente após {ate:HH:mm} (UTC).") { }
}

/// <summary>HTTP 403.</summary>
public sealed class AcessoNegadoException : AppException
{
    public AcessoNegadoException(string mensagem = "Você não tem permissão para acessar este recurso.") : base(mensagem) { }
}

/// <summary>HTTP 404.</summary>
public sealed class NaoEncontradoException : AppException
{
    public NaoEncontradoException(string recurso) : base($"{recurso} não encontrado(a).") { }
}

/// <summary>HTTP 409.</summary>
public sealed class ConflitoException : AppException
{
    public ConflitoException(string mensagem) : base(mensagem) { }
}

/// <summary>Acumula erros de validação e lança tudo de uma vez.</summary>
internal sealed class Validador
{
    private readonly Dictionary<string, List<string>> _erros = new();

    public Validador Exigir(bool condicao, string campo, string erro)
    {
        if (!condicao)
        {
            if (!_erros.TryGetValue(campo, out var lista)) _erros[campo] = lista = new List<string>();
            lista.Add(erro);
        }
        return this;
    }

    public void Lancar()
    {
        if (_erros.Count > 0) throw new ValidacaoException(_erros.ToDictionary(e => e.Key, e => e.Value.ToArray()));
    }
}

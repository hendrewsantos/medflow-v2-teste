namespace MedFlow.Domain.Comum;

/// <summary>Violação de regra de negócio (HTTP 422).</summary>
public class DomainException : Exception
{
    public DomainException(string mensagem) : base(mensagem) { }
}

/// <summary>Tentativa de mudar o status para um estado não permitido (HTTP 409) — RN08.</summary>
public sealed class TransicaoInvalidaException : DomainException
{
    public TransicaoInvalidaException(string mensagem) : base(mensagem) { }
}

/// <summary>Usuário autenticado, mas sem direito sobre o recurso (HTTP 403).</summary>
public sealed class OperacaoNaoAutorizadaException : DomainException
{
    public OperacaoNaoAutorizadaException(string mensagem) : base(mensagem) { }
}

/// <summary>Item da Box sem saldo disponível suficiente.</summary>
public sealed record FaltaEstoque(int MedicamentoId, string Medicamento, int Necessario, int Disponivel);

/// <summary>Estoque insuficiente na confirmação do pedido (HTTP 409) — RN03. Nada é reservado.</summary>
public sealed class EstoqueInsuficienteException : DomainException
{
    public IReadOnlyList<FaltaEstoque> Faltas { get; }

    public EstoqueInsuficienteException(IReadOnlyList<FaltaEstoque> faltas)
        : base("Estoque insuficiente para: " + string.Join(", ", faltas.Select(f => $"{f.Medicamento} (precisa {f.Necessario}, disponível {f.Disponivel})")) + ". Nenhuma reserva foi feita.")
    {
        Faltas = faltas;
    }
}

namespace MedFlow.Domain.Comum;

/// <summary>Classe base de todas as entidades persistidas.</summary>
public abstract class Entidade
{
    public int Id { get; protected set; }

    /// <summary>Usado apenas em testes para simular um registro já salvo.</summary>
    internal void DefinirId(int id) => Id = id;
}

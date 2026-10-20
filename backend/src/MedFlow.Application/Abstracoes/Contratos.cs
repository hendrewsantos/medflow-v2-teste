using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Abstracoes;

/// <summary>Unidade de trabalho sobre o banco. Implementada pelo AppDbContext (Infrastructure).</summary>
public interface IAppDbContext
{
    DbSet<Usuario> Usuarios { get; }
    DbSet<Consentimento> Consentimentos { get; }
    DbSet<Receita> Receitas { get; }
    DbSet<Medicamento> Medicamentos { get; }
    DbSet<Lote> Lotes { get; }
    DbSet<MovimentacaoEstoque> Movimentacoes { get; }
    DbSet<Tratamento> Tratamentos { get; }
    DbSet<Pedido> Pedidos { get; }
    DbSet<Entrega> Entregas { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IPasswordHasher
{
    string Gerar(string senha);
    bool Verificar(string senha, string hash);
}

public sealed record TokenGerado(string Token, DateTime ExpiraEm);

public interface ITokenService
{
    TokenGerado Gerar(Usuario usuario);
}

public interface IArquivoStorage
{
    Task<string> SalvarAsync(byte[] conteudo, string extensao, CancellationToken ct);
    Task<byte[]?> LerAsync(string caminho, CancellationToken ct);
    Task ExcluirAsync(string caminho, CancellationToken ct);
}

public interface IRelogio
{
    DateTime Agora { get; }
}

/// <summary>Quem está fazendo a requisição (extraído do JWT pela API).</summary>
public sealed record UsuarioLogado(int Id, PerfilUsuario Perfil)
{
    public bool EhEquipe => Perfil is PerfilUsuario.Administrador or PerfilUsuario.Funcionario;
}

public sealed class OpcoesLgpd
{
    public string VersaoTermos { get; set; } = "2026.1";
    public string VersaoConsentimentoSaude { get; set; } = "2026.1";
}

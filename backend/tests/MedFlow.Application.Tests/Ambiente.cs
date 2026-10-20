using MedFlow.Application.Abstracoes;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using MedFlow.Infrastructure.Persistencia;
using MedFlow.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MedFlow.Application.Tests;

internal sealed class RelogioFixo : IRelogio
{
    public DateTime Agora { get; set; } = new(2026, 10, 5, 11, 0, 0, DateTimeKind.Utc);
}

internal sealed class TokenFalso : ITokenService
{
    public TokenGerado Gerar(Usuario usuario) => new($"token-{usuario.Id}-{usuario.Perfil}", DateTime.UtcNow.AddHours(1));
}

internal sealed class StorageEmMemoria : IArquivoStorage
{
    public Dictionary<string, byte[]> Arquivos { get; } = new();
    public Task<string> SalvarAsync(byte[] conteudo, string extensao, CancellationToken ct)
    {
        var nome = $"{Guid.NewGuid():N}{extensao}";
        Arquivos[nome] = conteudo;
        return Task.FromResult(nome);
    }
    public Task<byte[]?> LerAsync(string caminho, CancellationToken ct) => Task.FromResult(Arquivos.TryGetValue(caminho, out var c) ? c : null);
    public Task ExcluirAsync(string caminho, CancellationToken ct) { Arquivos.Remove(caminho); return Task.CompletedTask; }
}

/// <summary>Banco em memória + serviços reais da camada de aplicação.</summary>
internal sealed class Ambiente
{
    public static readonly byte[] PdfValido = "%PDF-1.4 teste"u8.ToArray();

    public AppDbContext Db { get; }
    public RelogioFixo Relogio { get; } = new();
    public StorageEmMemoria Storage { get; } = new();
    public PasswordHasherPbkdf2 Hasher { get; } = new(iteracoes: 1_000);
    public IOptions<OpcoesLgpd> Lgpd { get; } = Options.Create(new OpcoesLgpd());

    public Ambiente()
    {
        var opcoes = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        Db = new AppDbContext(opcoes);
    }

    public Servicos.AuthService Auth() => new(Db, Hasher, new TokenFalso(), Relogio, Lgpd);
    public Servicos.ReceitaService Receitas() => new(Db, Storage, Relogio, Lgpd);
    public Servicos.PedidoService Pedidos() => new(Db, Relogio);
    public Servicos.PrivacidadeService Privacidade() => new(Db, Storage, Relogio);

    public async Task<Usuario> CriarUsuarioAsync(string nome, string email, string cpf, PerfilUsuario perfil)
    {
        var u = new Usuario(nome, email, cpf, Hasher.Gerar("Senha1234"), perfil, "Rua das Acácias, 120 — São Paulo/SP", Relogio.Agora);
        Db.Usuarios.Add(u);
        await Db.SaveChangesAsync();
        return u;
    }

    public async Task<Medicamento> CriarMedicamentoAsync(string nome, int quantidade, bool controlado = false)
    {
        var m = new Medicamento(nome, nome.ToLowerInvariant(), "50 mg", "comprimido", controlado ? Tarja.Preta : Tarja.Vermelha, controlado, 60);
        m.RegistrarEntrada($"{nome[..3].ToUpperInvariant()}-1", Relogio.Agora.AddMonths(-1), Relogio.Agora.AddMonths(10), quantidade, Relogio.Agora);
        Db.Medicamentos.Add(m);
        await Db.SaveChangesAsync();
        return m;
    }

    public static UsuarioLogado Logado(Usuario u) => new(u.Id, u.Perfil);
}

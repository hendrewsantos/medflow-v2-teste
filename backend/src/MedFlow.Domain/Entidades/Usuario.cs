using MedFlow.Domain.Comum;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Entidades;

public sealed class Usuario : Entidade
{
    public const int MaxFalhasLogin = 5;
    public static readonly TimeSpan TempoBloqueio = TimeSpan.FromMinutes(15);

    private readonly List<Consentimento> _consentimentos = new();

    private Usuario() { }

    public Usuario(string nome, string email, string cpf, string senhaHash, PerfilUsuario perfil, string? endereco, DateTime agora)
    {
        Nome = nome.Trim();
        Email = email.Trim().ToLowerInvariant();
        Cpf = CpfValidador.Normalizar(cpf);
        SenhaHash = senhaHash;
        Perfil = perfil;
        Endereco = endereco?.Trim();
        CriadoEm = agora;
        Ativo = true;
    }

    public string Nome { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string Cpf { get; private set; } = string.Empty;
    /// <summary>Hash PBKDF2 com salt — a senha em texto puro nunca é armazenada (RNF01).</summary>
    public string SenhaHash { get; private set; } = string.Empty;
    public PerfilUsuario Perfil { get; private set; }
    public string? Endereco { get; private set; }
    public string? Telefone { get; private set; }
    public DateTime CriadoEm { get; private set; }
    public bool Ativo { get; private set; }
    public DateTime? AnonimizadoEm { get; private set; }
    public int FalhasLogin { get; private set; }
    public DateTime? BloqueadoAte { get; private set; }
    public IReadOnlyCollection<Consentimento> Consentimentos => _consentimentos;

    public bool EstaBloqueado(DateTime agora) => BloqueadoAte.HasValue && BloqueadoAte.Value > agora;

    /// <summary>RN17 — após 5 falhas consecutivas a conta fica bloqueada por 15 minutos.</summary>
    public void RegistrarFalhaLogin(DateTime agora)
    {
        FalhasLogin++;
        if (FalhasLogin >= MaxFalhasLogin)
        {
            BloqueadoAte = agora.Add(TempoBloqueio);
            FalhasLogin = 0;
        }
    }

    public void RegistrarLoginComSucesso()
    {
        FalhasLogin = 0;
        BloqueadoAte = null;
    }

    public void RegistrarConsentimento(TipoConsentimento tipo, string versaoTermo, DateTime agora)
    {
        if (_consentimentos.Any(c => c.Tipo == tipo && c.VersaoTermo == versaoTermo && c.RevogadoEm is null)) return;
        _consentimentos.Add(new Consentimento(tipo, versaoTermo, agora));
    }

    public bool PossuiConsentimento(TipoConsentimento tipo) => _consentimentos.Any(c => c.Tipo == tipo && c.RevogadoEm is null);

    public void AtualizarDados(string nome, string email, string? endereco, string? telefone)
    {
        if (string.IsNullOrWhiteSpace(nome) || nome.Trim().Length < 3) throw new DomainException("Informe o nome completo.");
        Nome = nome.Trim();
        Email = email.Trim().ToLowerInvariant();
        Endereco = endereco?.Trim();
        Telefone = telefone?.Trim();
    }

    public void AlterarSenha(string novoHash) => SenhaHash = novoHash;

    public void DefinirAtivo(bool ativo) => Ativo = ativo;

    /// <summary>
    /// LGPD art. 18, VI — elimina os dados pessoais. Registros de pedidos e movimentações permanecem,
    /// já desvinculados do titular, para cumprir obrigação regulatória de rastreabilidade (art. 16, I).
    /// </summary>
    public void Anonimizar(DateTime agora)
    {
        Nome = "Titular removido";
        Email = $"removido-{Id}@anonimizado.medflow";
        Cpf = $"ANON{Id}";
        Endereco = null;
        Telefone = null;
        SenhaHash = string.Empty;
        Ativo = false;
        AnonimizadoEm = agora;
        foreach (var consentimento in _consentimentos.Where(x => x.RevogadoEm is null)) consentimento.Revogar(agora);
    }
}

/// <summary>Prova do consentimento (o ônus da prova é do controlador — LGPD art. 8º, §2º).</summary>
public sealed class Consentimento : Entidade
{
    private Consentimento() { }

    internal Consentimento(TipoConsentimento tipo, string versaoTermo, DateTime agora)
    {
        Tipo = tipo;
        VersaoTermo = versaoTermo;
        ConcedidoEm = agora;
    }

    public int UsuarioId { get; private set; }
    public TipoConsentimento Tipo { get; private set; }
    public string VersaoTermo { get; private set; } = string.Empty;
    public DateTime ConcedidoEm { get; private set; }
    public DateTime? RevogadoEm { get; private set; }

    internal void Revogar(DateTime agora) => RevogadoEm = agora;
}

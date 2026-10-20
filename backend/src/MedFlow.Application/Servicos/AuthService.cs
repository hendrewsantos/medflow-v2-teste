using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MedFlow.Application.Servicos;

/// <summary>UC01 Cadastrar conta · UC02 Autenticar-se (RF01, RF02, RN15, RN17, RNF01).</summary>
public sealed class AuthService
{
    private static string? _hashFicticio;

    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ITokenService _tokens;
    private readonly IRelogio _relogio;
    private readonly OpcoesLgpd _lgpd;

    public AuthService(IAppDbContext db, IPasswordHasher hasher, ITokenService tokens, IRelogio relogio, IOptions<OpcoesLgpd> lgpd)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
        _relogio = relogio;
        _lgpd = lgpd.Value;
    }

    public async Task<AuthResponse> CadastrarPacienteAsync(CadastroPacienteRequest r, CancellationToken ct = default)
    {
        new Validador()
            .Exigir(!string.IsNullOrWhiteSpace(r.Nome) && r.Nome.Trim().Length >= 3, "nome", "Informe o nome completo.")
            .Exigir(Regras.EmailValido(r.Email), "email", "E-mail inválido.")
            .Exigir(CpfValidador.EhValido(r.Cpf), "cpf", "CPF inválido.")
            .Exigir(Regras.SenhaForte(r.Senha), "senha", "A senha deve ter ao menos 8 caracteres, com letras e números.")
            .Exigir(!string.IsNullOrWhiteSpace(r.Endereco) && r.Endereco.Trim().Length >= 10, "endereco", "Informe o endereço completo para entrega.")
            .Exigir(r.AceiteTermos, "aceiteTermos", "É necessário aceitar os Termos de Uso e a Política de Privacidade (LGPD art. 7º, I).")
            .Lancar();

        var email = r.Email.Trim().ToLowerInvariant();
        var cpf = CpfValidador.Normalizar(r.Cpf);
        if (await _db.Usuarios.AnyAsync(u => u.Email == email, ct)) throw new ConflitoException("Este e-mail já está cadastrado.");
        if (await _db.Usuarios.AnyAsync(u => u.Cpf == cpf, ct)) throw new ConflitoException("Este CPF já está cadastrado.");

        var agora = _relogio.Agora;
        var usuario = new Usuario(r.Nome, email, cpf, _hasher.Gerar(r.Senha), PerfilUsuario.Paciente, r.Endereco, agora);
        usuario.AtualizarDados(r.Nome, email, r.Endereco, r.Telefone);
        usuario.RegistrarConsentimento(TipoConsentimento.TermosDeUso, _lgpd.VersaoTermos, agora);

        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync(ct);
        return GerarResposta(usuario);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest r, CancellationToken ct = default)
    {
        var email = (r.Email ?? string.Empty).Trim().ToLowerInvariant();
        var senha = r.Senha ?? string.Empty;
        var agora = _relogio.Agora;
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(u => u.Email == email, ct);

        if (usuario is null || !usuario.Ativo)
        {
            // Mesmo custo de processamento para e-mail inexistente: não revela quais contas existem.
            _hasher.Verificar(senha, _hashFicticio ??= _hasher.Gerar("senha-ficticia-0"));
            throw new CredenciaisInvalidasException();
        }

        if (usuario.EstaBloqueado(agora)) throw new ContaBloqueadaException(usuario.BloqueadoAte!.Value);

        if (!_hasher.Verificar(senha, usuario.SenhaHash))
        {
            usuario.RegistrarFalhaLogin(agora);
            await _db.SaveChangesAsync(ct);
            if (usuario.EstaBloqueado(agora)) throw new ContaBloqueadaException(usuario.BloqueadoAte!.Value);
            throw new CredenciaisInvalidasException();
        }

        usuario.RegistrarLoginComSucesso();
        await _db.SaveChangesAsync(ct);
        return GerarResposta(usuario);
    }

    public async Task<UsuarioResumo> ObterAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(x => x.Id == u.Id && x.Ativo, ct) ?? throw new NaoEncontradoException("Usuário");
        return usuario.ParaResumo();
    }

    private AuthResponse GerarResposta(Usuario usuario)
    {
        var token = _tokens.Gerar(usuario);
        return new AuthResponse(token.Token, token.ExpiraEm, usuario.ParaResumo());
    }
}

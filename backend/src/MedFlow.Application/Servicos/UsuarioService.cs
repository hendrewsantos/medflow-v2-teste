using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

/// <summary>UC13 Gerenciar usuários internos (RF04) — exclusivo do Administrador.</summary>
public sealed class UsuarioService
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IRelogio _relogio;

    public UsuarioService(IAppDbContext db, IPasswordHasher hasher, IRelogio relogio)
    {
        _db = db;
        _hasher = hasher;
        _relogio = relogio;
    }

    public async Task<IReadOnlyList<UsuarioResumo>> ListarAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        GarantirAdministrador(u);
        var usuarios = await _db.Usuarios.Where(x => x.AnonimizadoEm == null).OrderBy(x => x.Perfil).ThenBy(x => x.Nome).ToListAsync(ct);
        return usuarios.Select(x => x.ParaResumo()).ToList();
    }

    public async Task<UsuarioResumo> CriarInternoAsync(UsuarioLogado u, CriarUsuarioInternoRequest r, CancellationToken ct = default)
    {
        GarantirAdministrador(u);
        new Validador()
            .Exigir(!string.IsNullOrWhiteSpace(r.Nome) && r.Nome.Trim().Length >= 3, "nome", "Informe o nome completo.")
            .Exigir(Regras.EmailValido(r.Email), "email", "E-mail inválido.")
            .Exigir(CpfValidador.EhValido(r.Cpf), "cpf", "CPF inválido.")
            .Exigir(Regras.SenhaForte(r.Senha), "senha", "A senha deve ter ao menos 8 caracteres, com letras e números.")
            .Exigir(r.Perfil != PerfilUsuario.Paciente, "perfil", "Pacientes se cadastram pela tela pública de cadastro.")
            .Lancar();

        var email = r.Email.Trim().ToLowerInvariant();
        var cpf = CpfValidador.Normalizar(r.Cpf);
        if (await _db.Usuarios.AnyAsync(x => x.Email == email || x.Cpf == cpf, ct))
            throw new ConflitoException("Já existe um usuário com este e-mail ou CPF.");

        var usuario = new Usuario(r.Nome, email, cpf, _hasher.Gerar(r.Senha), r.Perfil, null, _relogio.Agora);
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync(ct);
        return usuario.ParaResumo();
    }

    public async Task<UsuarioResumo> DefinirAtivoAsync(UsuarioLogado u, int id, bool ativo, CancellationToken ct = default)
    {
        GarantirAdministrador(u);
        if (id == u.Id && !ativo) throw new ConflitoException("Você não pode desativar a própria conta.");
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(x => x.Id == id && x.AnonimizadoEm == null, ct) ?? throw new NaoEncontradoException("Usuário");
        usuario.DefinirAtivo(ativo);
        await _db.SaveChangesAsync(ct);
        return usuario.ParaResumo();
    }

    private static void GarantirAdministrador(UsuarioLogado u)
    {
        if (u.Perfil != PerfilUsuario.Administrador) throw new AcessoNegadoException();
    }
}

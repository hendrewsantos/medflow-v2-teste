using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

/// <summary>UC12 Gerenciar meus dados — direitos do titular (LGPD art. 18) · RF19, RN16.</summary>
public sealed class PrivacidadeService
{
    private readonly IAppDbContext _db;
    private readonly IArquivoStorage _storage;
    private readonly IRelogio _relogio;

    public PrivacidadeService(IAppDbContext db, IArquivoStorage storage, IRelogio relogio)
    {
        _db = db;
        _storage = storage;
        _relogio = relogio;
    }

    /// <summary>Art. 18, I, II e V — confirmação, acesso e portabilidade (exportação em JSON). Nunca inclui o hash da senha.</summary>
    public async Task<MeusDadosDto> ObterAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        var usuario = await _db.Usuarios.Include(x => x.Consentimentos).FirstOrDefaultAsync(x => x.Id == u.Id && x.Ativo, ct)
            ?? throw new NaoEncontradoException("Usuário");
        var receitas = await _db.Receitas.Where(r => r.PacienteId == u.Id).OrderByDescending(r => r.EnviadaEm).ToListAsync(ct);
        var pedidos = await _db.Pedidos.Include(p => p.Paciente).Include(p => p.Itens).Where(p => p.PacienteId == u.Id)
            .OrderByDescending(p => p.CriadoEm).ToListAsync(ct);

        return new MeusDadosDto(usuario.Id, usuario.Nome, usuario.Email, usuario.Cpf, usuario.Endereco, usuario.Telefone, usuario.CriadoEm,
            usuario.Consentimentos.Select(c => new ConsentimentoDto(c.Tipo, c.VersaoTermo, c.ConcedidoEm, c.RevogadoEm)).ToList(),
            receitas.Select(r => r.ParaDto(usuario.Nome)).ToList(),
            pedidos.Select(p => p.ParaResumo()).ToList());
    }

    /// <summary>Art. 18, III — correção de dados incompletos, inexatos ou desatualizados.</summary>
    public async Task<MeusDadosDto> AtualizarAsync(UsuarioLogado u, AtualizarMeusDadosRequest r, CancellationToken ct = default)
    {
        new Validador().Exigir(Regras.EmailValido(r.Email), "email", "E-mail inválido.").Lancar();
        var email = r.Email.Trim().ToLowerInvariant();
        if (await _db.Usuarios.AnyAsync(x => x.Email == email && x.Id != u.Id, ct)) throw new ConflitoException("Este e-mail já está em uso.");
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(x => x.Id == u.Id && x.Ativo, ct) ?? throw new NaoEncontradoException("Usuário");
        usuario.AtualizarDados(r.Nome, email, r.Endereco, r.Telefone);
        await _db.SaveChangesAsync(ct);
        return await ObterAsync(u, ct);
    }

    /// <summary>
    /// Art. 18, VI — eliminação. RN16: bloqueada se houver Box em andamento (o endereço ainda é necessário);
    /// pedidos pendentes são cancelados (reserva liberada); arquivos de receita são apagados;
    /// pedidos e movimentações ficam anonimizados para rastreabilidade sanitária (art. 16, I).
    /// </summary>
    public async Task ExcluirContaAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        if (u.Perfil != PerfilUsuario.Paciente) throw new AcessoNegadoException("Contas internas são desativadas pelo Administrador.");
        var agora = _relogio.Agora;
        if (await _db.Pedidos.AnyAsync(p => p.PacienteId == u.Id &&
            (p.Status == StatusPedido.EmSeparacao || p.Status == StatusPedido.AguardandoEntregador || p.Status == StatusPedido.EmRota), ct))
            throw new ConflitoException("Há uma Box em separação ou em rota. A exclusão fica disponível após a entrega.");

        var usuario = await _db.Usuarios.Include(x => x.Consentimentos).FirstOrDefaultAsync(x => x.Id == u.Id && x.Ativo, ct)
            ?? throw new NaoEncontradoException("Usuário");

        var pendentes = await _db.PedidosCompletos().Where(p => p.PacienteId == u.Id && p.Status == StatusPedido.Pendente).ToListAsync(ct);
        foreach (var pedido in pendentes) _db.Movimentacoes.AddRange(pedido.Cancelar(u.Id, agora));

        var receitas = await _db.Receitas.Where(r => r.PacienteId == u.Id).ToListAsync(ct);
        foreach (var receita in receitas)
        {
            if (!string.IsNullOrEmpty(receita.CaminhoArquivo)) await _storage.ExcluirAsync(receita.CaminhoArquivo, ct);
            receita.RemoverArquivo();
        }

        usuario.Anonimizar(agora);
        await _db.SalvarAsync(ct);
    }
}

using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MedFlow.Application.Servicos;

/// <summary>UC03 Enviar receita · UC06 Analisar receita (RF05, RF06, RN02, RN07, RN15).</summary>
public sealed class ReceitaService
{
    public const long TamanhoMaximoBytes = 10 * 1024 * 1024;

    private static readonly IReadOnlyDictionary<string, string> TiposPermitidos = new Dictionary<string, string>
    {
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
    };

    private readonly IAppDbContext _db;
    private readonly IArquivoStorage _storage;
    private readonly IRelogio _relogio;
    private readonly OpcoesLgpd _lgpd;

    public ReceitaService(IAppDbContext db, IArquivoStorage storage, IRelogio relogio, IOptions<OpcoesLgpd> lgpd)
    {
        _db = db;
        _storage = storage;
        _relogio = relogio;
        _lgpd = lgpd.Value;
    }

    public async Task<ReceitaDto> EnviarAsync(UsuarioLogado u, byte[] conteudo, string nomeArquivo, bool consentimentoSaude, CancellationToken ct = default)
    {
        if (u.Perfil != PerfilUsuario.Paciente) throw new AcessoNegadoException("Somente pacientes enviam receitas.");
        var extensao = Path.GetExtension(nomeArquivo ?? string.Empty).ToLowerInvariant();

        new Validador()
            .Exigir(consentimentoSaude, "consentimentoSaude", "Para enviar a receita é preciso consentir, de forma específica, com o uso dos seus dados de saúde (LGPD art. 11, I).")
            .Exigir(conteudo.Length > 0, "arquivo", "Envie o arquivo da receita.")
            .Exigir(conteudo.Length <= TamanhoMaximoBytes, "arquivo", "O arquivo deve ter no máximo 10 MB.")
            .Exigir(TiposPermitidos.ContainsKey(extensao) && AssinaturaConfere(extensao, conteudo), "arquivo", "Formato não aceito. Envie PDF, PNG ou JPG.")
            .Lancar();

        var agora = _relogio.Agora;
        var paciente = await _db.Usuarios.Include(x => x.Consentimentos).FirstAsync(x => x.Id == u.Id, ct);
        paciente.RegistrarConsentimento(TipoConsentimento.DadosDeSaude, _lgpd.VersaoConsentimentoSaude, agora);

        var caminho = await _storage.SalvarAsync(conteudo, extensao, ct);
        var receita = new Receita(u.Id, caminho, Path.GetFileName(nomeArquivo)!, TiposPermitidos[extensao], conteudo.Length, agora);
        _db.Receitas.Add(receita);
        await _db.SaveChangesAsync(ct);
        return receita.ParaDto(paciente.Nome);
    }

    public async Task<IReadOnlyList<ReceitaDto>> ListarMinhasAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        var receitas = await _db.Receitas.Where(r => r.PacienteId == u.Id).OrderByDescending(r => r.EnviadaEm).ToListAsync(ct);
        return receitas.Select(r => r.ParaDto()).ToList();
    }

    public async Task<IReadOnlyList<ReceitaDto>> ListarPendentesAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        GarantirFarmaceutico(u);
        var receitas = await _db.Receitas.Include(r => r.Paciente).Where(r => r.Status == StatusReceita.Pendente)
            .OrderBy(r => r.EnviadaEm).ToListAsync(ct);
        return receitas.Select(r => r.ParaDto()).ToList();
    }

    public async Task<(byte[] Conteudo, string TipoConteudo, string Nome)> ObterArquivoAsync(UsuarioLogado u, int id, CancellationToken ct = default)
    {
        var receita = await _db.Receitas.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NaoEncontradoException("Receita");
        if (receita.PacienteId != u.Id && u.Perfil != PerfilUsuario.Administrador) throw new AcessoNegadoException();
        var conteudo = await _storage.LerAsync(receita.CaminhoArquivo, ct) ?? throw new NaoEncontradoException("Arquivo da receita");
        return (conteudo, receita.TipoConteudo, receita.NomeOriginal);
    }

    /// <summary>Aprovação humana obrigatória (governança): os pedidos pendentes desta receita seguem para separação.</summary>
    public async Task<ReceitaDto> AprovarAsync(UsuarioLogado u, int id, AprovarReceitaRequest r, CancellationToken ct = default)
    {
        GarantirFarmaceutico(u);
        var agora = _relogio.Agora;
        var receita = await _db.Receitas.Include(x => x.Paciente).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NaoEncontradoException("Receita");
        receita.Aprovar(u.Id, r.ValidaAte, agora);

        var pedidos = await _db.Pedidos.Where(p => p.ReceitaId == id && p.Status == StatusPedido.Pendente).Include(p => p.Historico).ToListAsync(ct);
        foreach (var pedido in pedidos) pedido.IniciarSeparacao(u.Id, agora);

        await _db.SalvarAsync(ct);
        return receita.ParaDto();
    }

    /// <summary>RN07 — recusa com motivo obrigatório; pedidos pendentes são recusados e a reserva volta ao estoque.</summary>
    public async Task<ReceitaDto> RecusarAsync(UsuarioLogado u, int id, RecusarReceitaRequest r, CancellationToken ct = default)
    {
        GarantirFarmaceutico(u);
        var agora = _relogio.Agora;
        var receita = await _db.Receitas.Include(x => x.Paciente).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NaoEncontradoException("Receita");
        receita.Recusar(u.Id, r.Motivo, agora);

        var pedidos = await _db.PedidosCompletos().Where(p => p.ReceitaId == id && p.Status == StatusPedido.Pendente).ToListAsync(ct);
        foreach (var pedido in pedidos)
            _db.Movimentacoes.AddRange(pedido.Recusar(u.Id, $"Receita recusada: {r.Motivo.Trim()}", agora));

        await _db.SalvarAsync(ct);
        return receita.ParaDto();
    }

    /// <summary>Segregação de funções: só o farmacêutico (perfil Administrador) analisa receitas.</summary>
    private static void GarantirFarmaceutico(UsuarioLogado u)
    {
        if (u.Perfil != PerfilUsuario.Administrador) throw new AcessoNegadoException("Somente o farmacêutico responsável pode analisar receitas.");
    }

    /// <summary>Confere os "números mágicos" do arquivo — a extensão sozinha não prova o formato.</summary>
    internal static bool AssinaturaConfere(string extensao, byte[] c) => extensao switch
    {
        ".pdf" => c.Length >= 4 && c[0] == 0x25 && c[1] == 0x50 && c[2] == 0x44 && c[3] == 0x46,
        ".png" => c.Length >= 8 && c[0] == 0x89 && c[1] == 0x50 && c[2] == 0x4E && c[3] == 0x47 && c[4] == 0x0D && c[5] == 0x0A && c[6] == 0x1A && c[7] == 0x0A,
        ".jpg" or ".jpeg" => c.Length >= 3 && c[0] == 0xFF && c[1] == 0xD8 && c[2] == 0xFF,
        _ => false,
    };
}

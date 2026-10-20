using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

/// <summary>
/// UC14 Consultar indicadores (RF18). Métricas de resultado, não de atividade:
/// tempo de ciclo confirmação → entrega (P90), entrega na primeira tentativa e pedidos parados.
/// </summary>
public sealed class PainelService
{
    private readonly IAppDbContext _db;
    private readonly IRelogio _relogio;

    public PainelService(IAppDbContext db, IRelogio relogio)
    {
        _db = db;
        _relogio = relogio;
    }

    public async Task<IndicadoresDto> ObterAsync(UsuarioLogado u, CancellationToken ct = default)
    {
        if (!u.EhEquipe) throw new AcessoNegadoException();
        var agora = _relogio.Agora;
        var hoje = agora.Date;

        var contagem = await _db.Pedidos.GroupBy(p => p.Status).Select(g => new { Status = g.Key, Total = g.Count() }).ToListAsync(ct);
        var porStatus = Enum.GetValues<StatusPedido>().ToDictionary(s => s, s => contagem.FirstOrDefault(c => c.Status == s)?.Total ?? 0);

        var receitasPendentes = await _db.Receitas.CountAsync(r => r.Status == StatusReceita.Pendente, ct);

        var medicamentos = await _db.Medicamentos.Include(m => m.Lotes).Where(m => m.Ativo).ToListAsync(ct);
        var abaixoMinimo = medicamentos.Count(m => m.AbaixoDoMinimo(hoje));
        var lotes = medicamentos.SelectMany(m => m.Lotes).Where(l => l.QuantidadeFisica > 0).ToList();
        var vencendo = lotes.Count(l => l.VenceEmAte(hoje, CatalogoService.DiasAlertaValidade));
        var vencidos = lotes.Count(l => l.Vencido(hoje));

        var desde = agora.AddDays(-30);
        var entregues = await _db.Pedidos.Include(p => p.Historico).Include(p => p.Entregas)
            .Where(p => p.Status == StatusPedido.Entregue && p.AtualizadoEm >= desde).ToListAsync(ct);
        var ciclos = entregues
            .Select(p => (p.Historico.Where(h => h.Para == StatusPedido.Entregue).Select(h => h.Em).DefaultIfEmpty(p.AtualizadoEm).Max() - p.CriadoEm).TotalHours)
            .OrderBy(h => h).ToList();
        double? p90 = ciclos.Count == 0 ? null : Math.Round(ciclos[(int)Math.Ceiling(0.9 * ciclos.Count) - 1], 1);
        double? primeiraTentativa = entregues.Count == 0 ? null : Math.Round(100.0 * entregues.Count(p => p.Entregas.Count == 1) / entregues.Count, 1);

        var limite = agora.AddHours(-24);
        var parados = await _db.Pedidos.CountAsync(p => p.Status == StatusPedido.EmSeparacao && p.AtualizadoEm < limite, ct);

        return new IndicadoresDto(porStatus, receitasPendentes, abaixoMinimo, vencendo, vencidos, p90, primeiraTentativa, parados);
    }
}

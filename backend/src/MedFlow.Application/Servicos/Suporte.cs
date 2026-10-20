using System.Text.RegularExpressions;
using MedFlow.Application.Abstracoes;
using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Servicos;

internal static partial class Regras
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    public static bool EmailValido(string? email) => !string.IsNullOrWhiteSpace(email) && email.Length <= 150 && EmailRegex().IsMatch(email.Trim());

    /// <summary>RNF01 — mínimo de 8 caracteres, com ao menos uma letra e um número.</summary>
    public static bool SenhaForte(string? senha) =>
        !string.IsNullOrEmpty(senha) && senha.Length >= 8 && senha.Any(char.IsLetter) && senha.Any(char.IsDigit);

    /// <summary>
    /// Grava tudo numa única transação (SaveChanges). Se outro pedido alterou o mesmo lote ao mesmo tempo,
    /// o token de concorrência (Lote.Versao) impede a gravação e nada é salvo — evita a reserva dupla do mesmo saldo.
    /// </summary>
    public static async Task SalvarAsync(this IAppDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflitoException("O estoque foi alterado por outra operação ao mesmo tempo. Nada foi gravado; tente novamente.");
        }
    }
}

internal static class Mapeamentos
{
    public static UsuarioResumo ParaResumo(this Usuario u) =>
        new(u.Id, u.Nome, u.Email, CpfValidador.Mascarar(u.Cpf), u.Perfil, u.Ativo);

    public static ReceitaDto ParaDto(this Receita r, string? paciente = null) =>
        new(r.Id, r.PacienteId, paciente ?? r.Paciente?.Nome, r.NomeOriginal, r.TipoConteudo, r.TamanhoBytes,
            r.EnviadaEm, r.Status, r.ValidaAte, r.MotivoRecusa, r.AnalisadaEm);

    public static MedicamentoDto ParaDto(this Medicamento m, DateTime hoje, DateTime validoAte) =>
        new(m.Id, m.Nome, m.PrincipioAtivo, m.Concentracao, m.FormaFarmaceutica, m.Tarja, m.ControleEspecial, m.NivelMinimo,
            m.QuantidadeFisica, m.QuantidadeReservada, m.DisponivelAte(validoAte), m.AbaixoDoMinimo(hoje),
            m.Lotes.OrderBy(l => l.Validade)
                .Select(l => new LoteDto(l.Id, l.Numero, l.Fabricacao, l.Validade, l.QuantidadeFisica, l.QuantidadeReservada, l.Disponivel, l.Vencido(hoje)))
                .ToList());

    public static PedidoResumoDto ParaResumo(this Pedido p) =>
        new(p.Id, p.Paciente?.Nome ?? "—", p.Status, p.CriadoEm, p.AtualizadoEm, p.Itens.Count);

    public static PedidoDto ParaDto(this Pedido p)
    {
        var saches = p.Tratamento?.Saches ?? (IReadOnlyCollection<Sache>)Array.Empty<Sache>();
        var itens = p.Itens.Select(i =>
        {
            var doMedicamento = saches.Where(s => s.MedicamentoId == i.MedicamentoId).OrderBy(s => s.Horario).ToList();
            return new PedidoItemDto(
                i.MedicamentoId,
                i.Medicamento?.Nome ?? $"Medicamento {i.MedicamentoId}",
                i.Quantidade,
                doMedicamento.Select(s => s.Horario).ToList(),
                doMedicamento.FirstOrDefault()?.Quantidade ?? 0,
                i.Alocacoes.Select(a => new AlocacaoDto(a.Lote?.Numero ?? "—", a.Lote?.Validade ?? default, a.Quantidade)).ToList());
        }).ToList();

        return new PedidoDto(p.Id, p.PacienteId, p.Paciente?.Nome ?? "—", p.ReceitaId, p.Status, p.EnderecoEntrega, p.DiasCiclo,
            p.CriadoEm, p.AtualizadoEm, itens,
            p.Historico.OrderBy(h => h.Em).ThenBy(h => h.Id).Select(h => new HistoricoDto(h.De, h.Para, h.Em, h.Observacao)).ToList(),
            p.Entregas.OrderBy(e => e.Tentativa).Select(e => new EntregaDto(e.Tentativa, e.EntregadorId, e.IniciadaEm, e.ConcluidaEm, e.Resultado, e.Recebedor, e.Ocorrencia)).ToList());
    }
}

internal static class Consultas
{
    /// <summary>Pedido com tudo que as regras de transição precisam (itens → alocações → lotes).</summary>
    public static IQueryable<Pedido> PedidosCompletos(this IAppDbContext db) =>
        db.Pedidos
            .Include(p => p.Paciente)
            .Include(p => p.Tratamento).ThenInclude(t => t!.Saches)
            .Include(p => p.Itens).ThenInclude(i => i.Medicamento)
            .Include(p => p.Itens).ThenInclude(i => i.Alocacoes).ThenInclude(a => a.Lote)
            .Include(p => p.Historico)
            .Include(p => p.Entregas);
}

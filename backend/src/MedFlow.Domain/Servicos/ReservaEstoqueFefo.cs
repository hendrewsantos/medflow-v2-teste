using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Servicos;

/// <summary>
/// RN03 + RN04 — reserva o estoque na confirmação do pedido, consumindo primeiro os lotes que vencem antes
/// (FEFO: first expired, first out) e ignorando lotes que vencem antes do fim do ciclo.
/// A operação é "tudo ou nada": a falta é calculada para todos os itens antes de qualquer reserva.
/// </summary>
public static class ReservaEstoqueFefo
{
    public static IReadOnlyList<MovimentacaoEstoque> Reservar(
        Pedido pedido,
        IReadOnlyList<NecessidadeMedicamento> necessidades,
        IReadOnlyCollection<Medicamento> medicamentos,
        int? usuarioId,
        DateTime agora)
    {
        var validoAte = pedido.ValidoAte;
        var planos = new List<(NecessidadeMedicamento Necessidade, List<(Lote Lote, int Quantidade)> Alocacoes)>();
        var faltas = new List<FaltaEstoque>();

        foreach (var necessidade in necessidades)
        {
            var medicamento = medicamentos.FirstOrDefault(m => m.Id == necessidade.MedicamentoId)
                ?? throw new DomainException($"Medicamento {necessidade.MedicamentoId} não encontrado.");

            var restante = necessidade.Quantidade;
            var alocacoes = new List<(Lote Lote, int Quantidade)>();
            foreach (var lote in medicamento.Lotes
                         .Where(l => l.ValidoAte(validoAte) && l.Disponivel > 0)
                         .OrderBy(l => l.Validade)
                         .ThenBy(l => l.Id))
            {
                if (restante == 0) break;
                var quantidade = Math.Min(restante, lote.Disponivel);
                alocacoes.Add((lote, quantidade));
                restante -= quantidade;
            }

            if (restante > 0)
                faltas.Add(new FaltaEstoque(medicamento.Id, medicamento.Nome, necessidade.Quantidade, necessidade.Quantidade - restante));
            planos.Add((necessidade, alocacoes));
        }

        if (faltas.Count > 0) throw new EstoqueInsuficienteException(faltas);

        var movimentacoes = new List<MovimentacaoEstoque>();
        foreach (var (necessidade, alocacoes) in planos)
        {
            pedido.AdicionarItem(necessidade.MedicamentoId, necessidade.Quantidade, alocacoes);
            movimentacoes.AddRange(alocacoes.Select(a =>
                new MovimentacaoEstoque(a.Lote, TipoMovimentacao.Reserva, a.Quantidade, pedido, usuarioId, agora, "Reserva na confirmação do pedido.")));
        }
        return movimentacoes;
    }
}

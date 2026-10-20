using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using MedFlow.Domain.Servicos;

namespace MedFlow.Domain.Tests;

/// <summary>CT17–CT21 — reserva na confirmação, atomicidade, concorrência lógica e FEFO.</summary>
public class ReservaEstoqueTests
{
    [Fact(DisplayName = "CT17 — Confirmar com saldo suficiente reserva sem mexer no físico")]
    public void ReservaComSaldoSuficiente()
    {
        var losartana = Cenario.Medicamento(1, "Losartana", ("L1", 300, 100));
        var pedido = Cenario.Pedido(Cenario.Tratamento());

        var movs = ReservaEstoqueFefo.Reservar(pedido, new[] { new NecessidadeMedicamento(1, 60) }, new[] { losartana }, Cenario.PacienteId, Cenario.Agora);

        var lote = losartana.Lotes.Single();
        Assert.Equal(100, lote.QuantidadeFisica);
        Assert.Equal(60, lote.QuantidadeReservada);
        Assert.Equal(40, lote.Disponivel);
        Assert.Single(movs);
        Assert.Equal(TipoMovimentacao.Reserva, movs[0].Tipo);
        Assert.Equal(StatusPedido.Pendente, pedido.Status);
    }

    [Fact(DisplayName = "CT18 — Falta em um item: nada é reservado em nenhum item (tudo ou nada)")]
    public void FaltaEmUmItemNaoReservaNada()
    {
        var losartana = Cenario.Medicamento(1, "Losartana", ("L1", 300, 100));
        var atenolol = Cenario.Medicamento(2, "Atenolol", ("A1", 300, 40));
        var pedido = Cenario.Pedido(Cenario.Tratamento());

        var ex = Assert.Throws<EstoqueInsuficienteException>(() => ReservaEstoqueFefo.Reservar(pedido,
            new[] { new NecessidadeMedicamento(1, 60), new NecessidadeMedicamento(2, 60) },
            new[] { losartana, atenolol }, Cenario.PacienteId, Cenario.Agora));

        Assert.Single(ex.Faltas);
        Assert.Equal("Atenolol", ex.Faltas[0].Medicamento);
        Assert.Equal(0, losartana.QuantidadeReservada);
        Assert.Equal(0, atenolol.QuantidadeReservada);
        Assert.Empty(pedido.Itens);
    }

    [Fact(DisplayName = "CT19 — Dois pedidos sobre o mesmo saldo: o segundo é recusado")]
    public void DoisPedidosMesmoSaldo()
    {
        var losartana = Cenario.Medicamento(1, "Losartana", ("L1", 300, 60));
        var primeiro = Cenario.Pedido(Cenario.Tratamento());
        var segundo = Cenario.Pedido(Cenario.Tratamento());

        ReservaEstoqueFefo.Reservar(primeiro, new[] { new NecessidadeMedicamento(1, 60) }, new[] { losartana }, 10, Cenario.Agora);

        Assert.Throws<EstoqueInsuficienteException>(() =>
            ReservaEstoqueFefo.Reservar(segundo, new[] { new NecessidadeMedicamento(1, 60) }, new[] { losartana }, 11, Cenario.Agora));
        Assert.Equal(0, losartana.Lotes.Single().Disponivel);
    }

    [Fact(DisplayName = "CT20 — FEFO: consome primeiro o lote que vence antes")]
    public void ConsomeLoteQueVenceAntes()
    {
        var med = Cenario.Medicamento(1, "Metformina", ("TARDE", 400, 100), ("CEDO", 120, 50));
        var pedido = Cenario.Pedido(Cenario.Tratamento());

        ReservaEstoqueFefo.Reservar(pedido, new[] { new NecessidadeMedicamento(1, 80) }, new[] { med }, 10, Cenario.Agora);

        var alocacoes = pedido.Itens.Single().Alocacoes.ToList();
        Assert.Equal("CEDO", alocacoes[0].Lote!.Numero);
        Assert.Equal(50, alocacoes[0].Quantidade);
        Assert.Equal("TARDE", alocacoes[1].Lote!.Numero);
        Assert.Equal(30, alocacoes[1].Quantidade);
    }

    [Fact(DisplayName = "CT21 — Lote que vence antes do fim do ciclo não é reservado")]
    public void IgnoraLoteQueVenceDuranteOCiclo()
    {
        var med = Cenario.Medicamento(1, "Metformina", ("VENCE20D", 20, 500), ("OK", 300, 30));
        var pedido = Cenario.Pedido(Cenario.Tratamento());

        var ex = Assert.Throws<EstoqueInsuficienteException>(() =>
            ReservaEstoqueFefo.Reservar(pedido, new[] { new NecessidadeMedicamento(1, 60) }, new[] { med }, 10, Cenario.Agora));
        Assert.Equal(30, ex.Faltas[0].Disponivel);
    }
}

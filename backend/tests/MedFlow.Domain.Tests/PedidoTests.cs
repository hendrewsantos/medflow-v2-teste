using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using MedFlow.Domain.Servicos;

namespace MedFlow.Domain.Tests;

/// <summary>CT22–CT32 — máquina de estados, liberação de reserva, baixa e entrega.</summary>
public class PedidoTests
{
    private static (Pedido Pedido, Medicamento Medicamento) PedidoReservado(int quantidade = 60)
    {
        var med = Cenario.Medicamento(1, "Losartana", ("L1", 300, 100));
        var pedido = Cenario.Pedido(Cenario.Tratamento());
        ReservaEstoqueFefo.Reservar(pedido, new[] { new NecessidadeMedicamento(1, quantidade) }, new[] { med }, Cenario.PacienteId, Cenario.Agora);
        return (pedido, med);
    }

    [Fact(DisplayName = "CT22 — Receita aprovada leva o pedido para Em Separação")]
    public void IniciarSeparacao()
    {
        var (pedido, _) = PedidoReservado();
        pedido.IniciarSeparacao(Cenario.FarmaceuticoId, Cenario.Agora);
        Assert.Equal(StatusPedido.EmSeparacao, pedido.Status);
    }

    [Fact(DisplayName = "CT23 — Recusa libera a reserva")]
    public void RecusaLiberaReserva()
    {
        var (pedido, med) = PedidoReservado();
        var movs = pedido.Recusar(Cenario.FarmaceuticoId, "Receita ilegível", Cenario.Agora);
        Assert.Equal(StatusPedido.Recusado, pedido.Status);
        Assert.Equal(0, med.QuantidadeReservada);
        Assert.All(movs, m => Assert.Equal(TipoMovimentacao.LiberacaoReserva, m.Tipo));
    }

    [Fact(DisplayName = "CT25 — Finalizar Box baixa físico e reserva do lote")]
    public void FinalizarBoxBaixaEstoque()
    {
        var (pedido, med) = PedidoReservado();
        pedido.IniciarSeparacao(Cenario.FarmaceuticoId, Cenario.Agora);

        var movs = pedido.FinalizarBox(Cenario.OperadorId, Cenario.Agora.AddHours(2));

        var lote = med.Lotes.Single();
        Assert.Equal(40, lote.QuantidadeFisica);
        Assert.Equal(0, lote.QuantidadeReservada);
        Assert.Equal(StatusPedido.AguardandoEntregador, pedido.Status);
        Assert.Equal(TipoMovimentacao.Baixa, Assert.Single(movs).Tipo);
    }

    [Fact(DisplayName = "CT26 — Transição inválida é bloqueada (Pendente → Em Rota)")]
    public void TransicaoInvalida()
    {
        var (pedido, med) = PedidoReservado();
        Assert.Throws<TransicaoInvalidaException>(() => pedido.IniciarRota(Cenario.EntregadorId, Cenario.Agora));
        Assert.Throws<TransicaoInvalidaException>(() => pedido.FinalizarBox(Cenario.OperadorId, Cenario.Agora));
        Assert.Equal(60, med.QuantidadeReservada);
    }

    [Fact(DisplayName = "CT27 — Paciente cancela pendente; em separação não pode")]
    public void Cancelamento()
    {
        var (pedido, med) = PedidoReservado();
        pedido.Cancelar(Cenario.PacienteId, Cenario.Agora);
        Assert.Equal(StatusPedido.Cancelado, pedido.Status);
        Assert.Equal(0, med.QuantidadeReservada);

        var (outro, _) = PedidoReservado();
        outro.IniciarSeparacao(Cenario.FarmaceuticoId, Cenario.Agora);
        Assert.Throws<TransicaoInvalidaException>(() => outro.Cancelar(Cenario.PacienteId, Cenario.Agora));
    }

    [Fact(DisplayName = "CT27b — Outro paciente não cancela o pedido")]
    public void CancelamentoPorTerceiro()
    {
        var (pedido, _) = PedidoReservado();
        Assert.Throws<OperacaoNaoAutorizadaException>(() => pedido.Cancelar(999, Cenario.Agora));
    }

    [Fact(DisplayName = "CT28/CT29/CT30 — Rota, confirmação com recebedor e bloqueio de outro entregador")]
    public void FluxoDeEntrega()
    {
        var (pedido, _) = PedidoReservado();
        pedido.IniciarSeparacao(Cenario.FarmaceuticoId, Cenario.Agora);
        pedido.FinalizarBox(Cenario.OperadorId, Cenario.Agora);
        pedido.IniciarRota(Cenario.EntregadorId, Cenario.Agora.AddHours(3));
        Assert.Equal(StatusPedido.EmRota, pedido.Status);

        Assert.Throws<DomainException>(() => pedido.ConfirmarEntrega(Cenario.EntregadorId, "", Cenario.Agora.AddHours(4)));
        Assert.Throws<OperacaoNaoAutorizadaException>(() => pedido.ConfirmarEntrega(777, "Carlos", Cenario.Agora.AddHours(4)));

        pedido.ConfirmarEntrega(Cenario.EntregadorId, "Carlos Mendes", Cenario.Agora.AddHours(4));
        Assert.Equal(StatusPedido.Entregue, pedido.Status);
        Assert.Equal("Carlos Mendes", pedido.Entregas.Single().Recebedor);
    }

    [Fact(DisplayName = "CT31 — Ocorrência devolve o pedido para a fila e abre nova tentativa")]
    public void Ocorrencia()
    {
        var (pedido, _) = PedidoReservado();
        pedido.IniciarSeparacao(Cenario.FarmaceuticoId, Cenario.Agora);
        pedido.FinalizarBox(Cenario.OperadorId, Cenario.Agora);
        pedido.IniciarRota(Cenario.EntregadorId, Cenario.Agora);
        pedido.RegistrarOcorrencia(Cenario.EntregadorId, "Destinatário ausente", Cenario.Agora.AddHours(1));
        Assert.Equal(StatusPedido.AguardandoEntregador, pedido.Status);

        pedido.IniciarRota(Cenario.EntregadorId, Cenario.Agora.AddHours(5));
        Assert.Equal(2, pedido.Entregas.Count);
        Assert.Equal(2, pedido.EntregaAtual!.Tentativa);
    }

    [Fact(DisplayName = "CT32 — Histórico registra todas as transições em ordem")]
    public void Historico()
    {
        var (pedido, _) = PedidoReservado();
        pedido.IniciarSeparacao(Cenario.FarmaceuticoId, Cenario.Agora);
        pedido.FinalizarBox(Cenario.OperadorId, Cenario.Agora);
        var status = pedido.Historico.Select(h => h.Para).ToArray();
        Assert.Equal(new[] { StatusPedido.Pendente, StatusPedido.EmSeparacao, StatusPedido.AguardandoEntregador }, status);
    }
}

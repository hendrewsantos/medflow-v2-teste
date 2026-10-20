using MedFlow.Domain.Comum;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Entidades;

/// <summary>
/// Pedido de um ciclo da Box. Concentra a máquina de estados (RN08), a liberação de reserva (RN07)
/// e a baixa definitiva na finalização (RN06).
/// </summary>
public sealed class Pedido : Entidade
{
    public const int DiasCicloPadrao = 30;

    private static readonly IReadOnlyDictionary<StatusPedido, StatusPedido[]> Transicoes = new Dictionary<StatusPedido, StatusPedido[]>
    {
        [StatusPedido.Pendente] = new[] { StatusPedido.EmSeparacao, StatusPedido.Recusado, StatusPedido.Cancelado },
        [StatusPedido.EmSeparacao] = new[] { StatusPedido.AguardandoEntregador },
        [StatusPedido.AguardandoEntregador] = new[] { StatusPedido.EmRota },
        [StatusPedido.EmRota] = new[] { StatusPedido.Entregue, StatusPedido.AguardandoEntregador },
        [StatusPedido.Entregue] = Array.Empty<StatusPedido>(),
        [StatusPedido.Cancelado] = Array.Empty<StatusPedido>(),
        [StatusPedido.Recusado] = Array.Empty<StatusPedido>(),
    };

    private readonly List<PedidoItem> _itens = new();
    private readonly List<HistoricoPedido> _historico = new();
    private readonly List<Entrega> _entregas = new();

    private Pedido() { }

    public Pedido(int pacienteId, Tratamento tratamento, int receitaId, string enderecoEntrega, DateTime agora, int diasCiclo = DiasCicloPadrao)
    {
        if (string.IsNullOrWhiteSpace(enderecoEntrega) || enderecoEntrega.Trim().Length < 10)
            throw new DomainException("Informe o endereço completo de entrega.");
        PacienteId = pacienteId;
        Tratamento = tratamento;
        TratamentoId = tratamento.Id;
        ReceitaId = receitaId;
        EnderecoEntrega = enderecoEntrega.Trim();
        DiasCiclo = diasCiclo;
        CriadoEm = agora;
        AtualizadoEm = agora;
        Status = StatusPedido.Pendente;
        _historico.Add(new HistoricoPedido(null, StatusPedido.Pendente, pacienteId, agora, "Pedido confirmado e estoque reservado."));
    }

    public int PacienteId { get; private set; }
    public Usuario? Paciente { get; private set; }
    public int TratamentoId { get; private set; }
    public Tratamento? Tratamento { get; private set; }
    public int ReceitaId { get; private set; }
    public StatusPedido Status { get; private set; }
    public string EnderecoEntrega { get; private set; } = string.Empty;
    public int DiasCiclo { get; private set; }
    public DateTime CriadoEm { get; private set; }
    public DateTime AtualizadoEm { get; private set; }
    public IReadOnlyCollection<PedidoItem> Itens => _itens;
    public IReadOnlyCollection<HistoricoPedido> Historico => _historico;
    public IReadOnlyCollection<Entrega> Entregas => _entregas;

    /// <summary>Data até a qual os lotes reservados precisam estar válidos (RN04).</summary>
    public DateTime ValidoAte => CriadoEm.Date.AddDays(DiasCiclo);

    public Entrega? EntregaAtual => _entregas.Where(e => e.Resultado == ResultadoEntrega.EmAndamento).OrderByDescending(e => e.Tentativa).FirstOrDefault();

    public static bool TransicaoPermitida(StatusPedido de, StatusPedido para) => Transicoes[de].Contains(para);

    internal void AdicionarItem(int medicamentoId, int quantidade, IReadOnlyList<(Lote Lote, int Quantidade)> alocacoes)
    {
        var item = new PedidoItem(medicamentoId, quantidade);
        foreach (var (lote, qtd) in alocacoes) item.AlocarLote(lote, qtd);
        _itens.Add(item);
    }

    /// <summary>Chamado quando o farmacêutico aprova a receita (ou quando a receita já estava aprovada).</summary>
    public void IniciarSeparacao(int? farmaceuticoId, DateTime agora, string observacao = "Receita aprovada pelo farmacêutico.")
        => MudarStatus(StatusPedido.EmSeparacao, farmaceuticoId, agora, observacao);

    /// <summary>RN07 — receita recusada: o pedido é recusado e a reserva volta ao saldo disponível.</summary>
    public IReadOnlyList<MovimentacaoEstoque> Recusar(int farmaceuticoId, string motivo, DateTime agora)
    {
        GarantirTransicao(StatusPedido.Recusado);
        var movimentacoes = LiberarReservas(farmaceuticoId, agora, "Reserva liberada: receita recusada.");
        MudarStatus(StatusPedido.Recusado, farmaceuticoId, agora, motivo);
        return movimentacoes;
    }

    /// <summary>RN07 — o paciente só cancela enquanto o pedido está Pendente.</summary>
    public IReadOnlyList<MovimentacaoEstoque> Cancelar(int pacienteId, DateTime agora)
    {
        if (pacienteId != PacienteId) throw new OperacaoNaoAutorizadaException("Somente o titular pode cancelar este pedido.");
        GarantirTransicao(StatusPedido.Cancelado);
        var movimentacoes = LiberarReservas(pacienteId, agora, "Reserva liberada: pedido cancelado pelo paciente.");
        MudarStatus(StatusPedido.Cancelado, pacienteId, agora, "Cancelado pelo paciente.");
        return movimentacoes;
    }

    /// <summary>RN06 — Box separada fisicamente: baixa definitiva lote a lote.</summary>
    public IReadOnlyList<MovimentacaoEstoque> FinalizarBox(int operadorId, DateTime agora)
    {
        GarantirTransicao(StatusPedido.AguardandoEntregador);
        var movimentacoes = new List<MovimentacaoEstoque>();
        foreach (var item in _itens)
        foreach (var alocacao in item.Alocacoes)
        {
            var lote = alocacao.Lote ?? throw new InvalidOperationException("Lote da alocação não foi carregado.");
            lote.BaixarReservado(alocacao.Quantidade);
            movimentacoes.Add(new MovimentacaoEstoque(lote, TipoMovimentacao.Baixa, alocacao.Quantidade, this, operadorId, agora, "Baixa na finalização da Box."));
        }
        MudarStatus(StatusPedido.AguardandoEntregador, operadorId, agora, "Box separada e finalizada; baixa definitiva no estoque.");
        return movimentacoes;
    }

    public void IniciarRota(int entregadorId, DateTime agora)
    {
        GarantirTransicao(StatusPedido.EmRota);
        _entregas.Add(new Entrega(entregadorId, _entregas.Count + 1, agora));
        MudarStatus(StatusPedido.EmRota, entregadorId, agora, $"Saiu para entrega (tentativa {_entregas.Count}).");
    }

    /// <summary>RN14 — só o entregador da rota confirma, informando quem recebeu.</summary>
    public void ConfirmarEntrega(int entregadorId, string recebedor, DateTime agora)
    {
        GarantirTransicao(StatusPedido.Entregue);
        var entrega = EntregaDoEntregador(entregadorId);
        if (string.IsNullOrWhiteSpace(recebedor) || recebedor.Trim().Length < 3)
            throw new DomainException("Informe o nome de quem recebeu a Box.");
        entrega.Concluir(recebedor.Trim(), agora);
        MudarStatus(StatusPedido.Entregue, entregadorId, agora, $"Entregue para {recebedor.Trim()}.");
    }

    /// <summary>Ocorrência (destinatário ausente, endereço não localizado...): o pedido volta para a fila.</summary>
    public void RegistrarOcorrencia(int entregadorId, string motivo, DateTime agora)
    {
        GarantirTransicao(StatusPedido.AguardandoEntregador);
        var entrega = EntregaDoEntregador(entregadorId);
        if (string.IsNullOrWhiteSpace(motivo) || motivo.Trim().Length < 5)
            throw new DomainException("Descreva a ocorrência (mínimo de 5 caracteres).");
        entrega.Falhar(motivo.Trim(), agora);
        MudarStatus(StatusPedido.AguardandoEntregador, entregadorId, agora, $"Ocorrência na entrega: {motivo.Trim()}");
    }

    private Entrega EntregaDoEntregador(int entregadorId)
    {
        var entrega = EntregaAtual ?? throw new DomainException("Não há entrega em andamento para este pedido.");
        if (entrega.EntregadorId != entregadorId)
            throw new OperacaoNaoAutorizadaException("Somente o entregador que iniciou a rota pode concluir esta entrega.");
        return entrega;
    }

    private List<MovimentacaoEstoque> LiberarReservas(int? usuarioId, DateTime agora, string observacao)
    {
        var movimentacoes = new List<MovimentacaoEstoque>();
        foreach (var item in _itens)
        foreach (var alocacao in item.Alocacoes)
        {
            var lote = alocacao.Lote ?? throw new InvalidOperationException("Lote da alocação não foi carregado.");
            lote.LiberarReserva(alocacao.Quantidade);
            movimentacoes.Add(new MovimentacaoEstoque(lote, TipoMovimentacao.LiberacaoReserva, alocacao.Quantidade, this, usuarioId, agora, observacao));
        }
        return movimentacoes;
    }

    private void GarantirTransicao(StatusPedido novo)
    {
        if (!TransicaoPermitida(Status, novo))
            throw new TransicaoInvalidaException($"Não é possível passar o pedido de {Status} para {novo}.");
    }

    private void MudarStatus(StatusPedido novo, int? usuarioId, DateTime agora, string? observacao)
    {
        GarantirTransicao(novo);
        _historico.Add(new HistoricoPedido(Status, novo, usuarioId, agora, observacao));
        Status = novo;
        AtualizadoEm = agora;
    }
}

public sealed class PedidoItem : Entidade
{
    private readonly List<AlocacaoLote> _alocacoes = new();

    private PedidoItem() { }

    internal PedidoItem(int medicamentoId, int quantidade)
    {
        MedicamentoId = medicamentoId;
        Quantidade = quantidade;
    }

    public int PedidoId { get; private set; }
    public int MedicamentoId { get; private set; }
    public Medicamento? Medicamento { get; private set; }
    /// <summary>Unidades do medicamento para todo o ciclo.</summary>
    public int Quantidade { get; private set; }
    public IReadOnlyCollection<AlocacaoLote> Alocacoes => _alocacoes;

    internal void AlocarLote(Lote lote, int quantidade)
    {
        lote.Reservar(quantidade);
        _alocacoes.Add(new AlocacaoLote(lote, quantidade));
    }
}

/// <summary>De qual lote saiu cada parte do item — rastreabilidade sanitária até o sachê.</summary>
public sealed class AlocacaoLote : Entidade
{
    private AlocacaoLote() { }

    internal AlocacaoLote(Lote lote, int quantidade)
    {
        Lote = lote;
        LoteId = lote.Id;
        Quantidade = quantidade;
    }

    public int PedidoItemId { get; private set; }
    public int LoteId { get; private set; }
    public Lote? Lote { get; private set; }
    public int Quantidade { get; private set; }
}

/// <summary>Linha do tempo honesta do pedido (RN13): toda transição com data, autor e motivo.</summary>
public sealed class HistoricoPedido : Entidade
{
    private HistoricoPedido() { }

    internal HistoricoPedido(StatusPedido? de, StatusPedido para, int? usuarioId, DateTime em, string? observacao)
    {
        De = de;
        Para = para;
        UsuarioId = usuarioId;
        Em = em;
        Observacao = observacao;
    }

    public int PedidoId { get; private set; }
    public StatusPedido? De { get; private set; }
    public StatusPedido Para { get; private set; }
    public int? UsuarioId { get; private set; }
    public DateTime Em { get; private set; }
    public string? Observacao { get; private set; }
}

public sealed class Entrega : Entidade
{
    private Entrega() { }

    internal Entrega(int entregadorId, int tentativa, DateTime agora)
    {
        EntregadorId = entregadorId;
        Tentativa = tentativa;
        IniciadaEm = agora;
        Resultado = ResultadoEntrega.EmAndamento;
    }

    public int PedidoId { get; private set; }
    public int EntregadorId { get; private set; }
    public int Tentativa { get; private set; }
    public DateTime IniciadaEm { get; private set; }
    public DateTime? ConcluidaEm { get; private set; }
    public ResultadoEntrega Resultado { get; private set; }
    public string? Recebedor { get; private set; }
    public string? Ocorrencia { get; private set; }

    internal void Concluir(string recebedor, DateTime agora)
    {
        Resultado = ResultadoEntrega.Entregue;
        Recebedor = recebedor;
        ConcluidaEm = agora;
    }

    internal void Falhar(string ocorrencia, DateTime agora)
    {
        Resultado = ResultadoEntrega.NaoRealizada;
        Ocorrencia = ocorrencia;
        ConcluidaEm = agora;
    }
}

public sealed class MovimentacaoEstoque : Entidade
{
    private MovimentacaoEstoque() { }

    public MovimentacaoEstoque(Lote lote, TipoMovimentacao tipo, int quantidade, Pedido? pedido, int? usuarioId, DateTime em, string observacao)
    {
        Lote = lote;
        LoteId = lote.Id;
        Tipo = tipo;
        Quantidade = quantidade;
        Pedido = pedido;
        PedidoId = pedido?.Id;
        UsuarioId = usuarioId;
        Em = em;
        Observacao = observacao;
    }

    public int LoteId { get; private set; }
    public Lote? Lote { get; private set; }
    public TipoMovimentacao Tipo { get; private set; }
    public int Quantidade { get; private set; }
    public int? PedidoId { get; private set; }
    public Pedido? Pedido { get; private set; }
    public int? UsuarioId { get; private set; }
    public DateTime Em { get; private set; }
    public string Observacao { get; private set; } = string.Empty;
}

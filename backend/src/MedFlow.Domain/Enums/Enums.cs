namespace MedFlow.Domain.Enums;

public enum PerfilUsuario
{
    Paciente = 1,
    /// <summary>Farmacêutico responsável técnico: único perfil que analisa receitas.</summary>
    Administrador = 2,
    /// <summary>Operador da farmácia: separa Boxes e movimenta estoque.</summary>
    Funcionario = 3,
    Entregador = 4
}

public enum StatusReceita { Pendente = 1, Aprovada = 2, Recusada = 3 }

/// <summary>Estados do pedido (Box do ciclo). Transições em <see cref="Entidades.Pedido"/>.</summary>
public enum StatusPedido
{
    Pendente = 1,
    EmSeparacao = 2,
    AguardandoEntregador = 3,
    EmRota = 4,
    Entregue = 5,
    Cancelado = 6,
    Recusado = 7
}

public enum TipoMovimentacao { Entrada = 1, Reserva = 2, LiberacaoReserva = 3, Baixa = 4 }

public enum Tarja { Livre = 0, Vermelha = 1, Preta = 2 }

public enum TipoConsentimento
{
    /// <summary>Dados pessoais comuns — LGPD art. 7º, I.</summary>
    TermosDeUso = 1,
    /// <summary>Dados sensíveis de saúde — LGPD art. 11, I.</summary>
    DadosDeSaude = 2
}

public enum ResultadoEntrega { EmAndamento = 1, Entregue = 2, NaoRealizada = 3 }

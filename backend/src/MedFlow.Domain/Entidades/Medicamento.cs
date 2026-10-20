using MedFlow.Domain.Comum;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Entidades;

public sealed class Medicamento : Entidade
{
    private readonly List<Lote> _lotes = new();

    private Medicamento() { }

    public Medicamento(string nome, string principioAtivo, string concentracao, string formaFarmaceutica,
        Tarja tarja, bool controleEspecial, int nivelMinimo)
    {
        if (string.IsNullOrWhiteSpace(nome)) throw new DomainException("Informe o nome do medicamento.");
        if (nivelMinimo < 0) throw new DomainException("O nível mínimo não pode ser negativo.");
        Nome = nome.Trim();
        PrincipioAtivo = principioAtivo.Trim();
        Concentracao = concentracao.Trim();
        FormaFarmaceutica = formaFarmaceutica.Trim();
        Tarja = tarja;
        ControleEspecial = controleEspecial;
        NivelMinimo = nivelMinimo;
        Ativo = true;
    }

    public string Nome { get; private set; } = string.Empty;
    public string PrincipioAtivo { get; private set; } = string.Empty;
    public string Concentracao { get; private set; } = string.Empty;
    public string FormaFarmaceutica { get; private set; } = string.Empty;
    public Tarja Tarja { get; private set; }
    /// <summary>Substâncias da Portaria SVS/MS nº 344/1998 — não entram na Box fracionada (RN09).</summary>
    public bool ControleEspecial { get; private set; }
    public int NivelMinimo { get; private set; }
    public bool Ativo { get; private set; }
    public IReadOnlyCollection<Lote> Lotes => _lotes;

    public int QuantidadeFisica => _lotes.Sum(l => l.QuantidadeFisica);
    public int QuantidadeReservada => _lotes.Sum(l => l.QuantidadeReservada);

    /// <summary>Saldo disponível (físico − reservado) apenas em lotes válidos até a data informada.</summary>
    public int DisponivelAte(DateTime validoAte) => _lotes.Where(l => l.ValidoAte(validoAte)).Sum(l => l.Disponivel);

    /// <summary>RN10 — alerta quando o disponível em lotes não vencidos fica igual ou abaixo do mínimo.</summary>
    public bool AbaixoDoMinimo(DateTime hoje) => DisponivelAte(hoje) <= NivelMinimo;

    public void Atualizar(string nome, string principioAtivo, string concentracao, string formaFarmaceutica, Tarja tarja, bool controleEspecial, int nivelMinimo)
    {
        if (string.IsNullOrWhiteSpace(nome)) throw new DomainException("Informe o nome do medicamento.");
        if (nivelMinimo < 0) throw new DomainException("O nível mínimo não pode ser negativo.");
        Nome = nome.Trim();
        PrincipioAtivo = principioAtivo.Trim();
        Concentracao = concentracao.Trim();
        FormaFarmaceutica = formaFarmaceutica.Trim();
        Tarja = tarja;
        ControleEspecial = controleEspecial;
        NivelMinimo = nivelMinimo;
    }

    public Lote RegistrarEntrada(string numero, DateTime fabricacao, DateTime validade, int quantidade, DateTime agora)
    {
        if (string.IsNullOrWhiteSpace(numero)) throw new DomainException("Informe o número do lote.");
        if (quantidade <= 0) throw new DomainException("A quantidade de entrada deve ser maior que zero.");
        if (validade.Date <= fabricacao.Date) throw new DomainException("A validade deve ser posterior à fabricação.");
        if (validade.Date <= agora.Date) throw new DomainException("Não é permitido dar entrada em lote vencido (RN05).");
        if (_lotes.Any(l => l.Numero.Equals(numero.Trim(), StringComparison.OrdinalIgnoreCase)))
            throw new DomainException($"O lote {numero} já está cadastrado para este medicamento.");

        var lote = new Lote(this, numero.Trim(), fabricacao.Date, validade.Date, quantidade);
        _lotes.Add(lote);
        return lote;
    }
}

public sealed class Lote : Entidade
{
    private Lote() { }

    internal Lote(Medicamento medicamento, string numero, DateTime fabricacao, DateTime validade, int quantidade)
    {
        Medicamento = medicamento;
        MedicamentoId = medicamento.Id;
        Numero = numero;
        Fabricacao = fabricacao;
        Validade = validade;
        QuantidadeFisica = quantidade;
    }

    public int MedicamentoId { get; private set; }
    public Medicamento? Medicamento { get; private set; }
    public string Numero { get; private set; } = string.Empty;
    public DateTime Fabricacao { get; private set; }
    public DateTime Validade { get; private set; }
    /// <summary>Unidades fisicamente na prateleira.</summary>
    public int QuantidadeFisica { get; private set; }
    /// <summary>Unidades empenhadas por pedidos confirmados e ainda não separados.</summary>
    public int QuantidadeReservada { get; private set; }
    /// <summary>Token de concorrência otimista: dois pedidos não conseguem reservar o mesmo saldo.</summary>
    public int Versao { get; private set; }

    public int Disponivel => QuantidadeFisica - QuantidadeReservada;

    public bool Vencido(DateTime hoje) => Validade.Date < hoje.Date;

    public bool ValidoAte(DateTime data) => Validade.Date >= data.Date;

    public bool VenceEmAte(DateTime hoje, int dias) => !Vencido(hoje) && Validade.Date <= hoje.Date.AddDays(dias);

    internal void Reservar(int quantidade)
    {
        if (quantidade <= 0) throw new DomainException("Quantidade de reserva inválida.");
        if (quantidade > Disponivel) throw new DomainException($"Lote {Numero} sem saldo disponível suficiente.");
        QuantidadeReservada += quantidade;
        Versao++;
    }

    internal void LiberarReserva(int quantidade)
    {
        if (quantidade <= 0 || quantidade > QuantidadeReservada) throw new DomainException($"Liberação inválida no lote {Numero}.");
        QuantidadeReservada -= quantidade;
        Versao++;
    }

    /// <summary>RN06 — baixa definitiva: sai do físico e da reserva ao mesmo tempo.</summary>
    internal void BaixarReservado(int quantidade)
    {
        if (quantidade <= 0 || quantidade > QuantidadeReservada) throw new DomainException($"Baixa inválida no lote {Numero}.");
        QuantidadeReservada -= quantidade;
        QuantidadeFisica -= quantidade;
        Versao++;
    }
}

using System.Globalization;
using MedFlow.Domain.Comum;

namespace MedFlow.Domain.Entidades;

/// <summary>Configuração da Box: quais medicamentos, em quais horários e quantas unidades por dose.</summary>
public sealed class Tratamento : Entidade
{
    public const int MaxUnidadesPorDose = 4;
    public const int MaxHorariosPorMedicamento = 6;

    private readonly List<Sache> _saches = new();

    private Tratamento() { }

    public Tratamento(int pacienteId, int receitaId, DateTime agora)
    {
        PacienteId = pacienteId;
        ReceitaId = receitaId;
        CriadoEm = agora;
        Ativo = true;
    }

    public int PacienteId { get; private set; }
    public int ReceitaId { get; private set; }
    public DateTime CriadoEm { get; private set; }
    public bool Ativo { get; private set; }
    public IReadOnlyCollection<Sache> Saches => _saches;

    /// <summary>RN09 e RN11 — validações de cada dose configurada pelo paciente.</summary>
    public void AdicionarSache(Medicamento medicamento, string horario, int quantidade)
    {
        if (!medicamento.Ativo) throw new DomainException($"{medicamento.Nome} não está disponível no catálogo.");
        if (medicamento.ControleEspecial)
            throw new DomainException($"{medicamento.Nome} é de controle especial (Portaria SVS/MS 344/1998) e não pode ser fracionado na Box.");
        if (quantidade < 1 || quantidade > MaxUnidadesPorDose)
            throw new DomainException($"A quantidade por dose deve ficar entre 1 e {MaxUnidadesPorDose} unidades.");
        if (!TimeOnly.TryParseExact(horario, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var hora))
            throw new DomainException($"Horário inválido: '{horario}'. Use o formato HH:mm.");

        var horarioNormalizado = hora.ToString("HH:mm", CultureInfo.InvariantCulture);
        var doMesmoMedicamento = _saches.Where(s => s.MedicamentoId == medicamento.Id).ToList();
        if (doMesmoMedicamento.Any(s => s.Horario == horarioNormalizado))
            throw new DomainException($"O horário {horarioNormalizado} já foi configurado para {medicamento.Nome}.");
        if (doMesmoMedicamento.Count >= MaxHorariosPorMedicamento)
            throw new DomainException($"Máximo de {MaxHorariosPorMedicamento} horários por medicamento.");

        _saches.Add(new Sache(medicamento, horarioNormalizado, quantidade));
    }

    /// <summary>Total de unidades de cada medicamento para o ciclo (soma das doses diárias × dias).</summary>
    public IReadOnlyList<NecessidadeMedicamento> NecessidadesDoCiclo(int diasCiclo)
    {
        if (_saches.Count == 0) throw new DomainException("A Box precisa de pelo menos um medicamento.");
        return _saches
            .GroupBy(s => s.MedicamentoId)
            .Select(g => new NecessidadeMedicamento(g.Key, g.Sum(s => s.Quantidade) * diasCiclo))
            .ToList();
    }
}

public sealed record NecessidadeMedicamento(int MedicamentoId, int Quantidade);

public sealed class Sache : Entidade
{
    private Sache() { }

    internal Sache(Medicamento medicamento, string horario, int quantidade)
    {
        Medicamento = medicamento;
        MedicamentoId = medicamento.Id;
        Horario = horario;
        Quantidade = quantidade;
    }

    public int TratamentoId { get; private set; }
    public int MedicamentoId { get; private set; }
    public Medicamento? Medicamento { get; private set; }
    /// <summary>Horário da dose no formato HH:mm.</summary>
    public string Horario { get; private set; } = string.Empty;
    /// <summary>Unidades (comprimidos/cápsulas) neste horário.</summary>
    public int Quantidade { get; private set; }
}

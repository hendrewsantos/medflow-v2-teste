using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Tests;

/// <summary>Monta objetos de domínio em memória para os testes (sem banco).</summary>
internal static class Cenario
{
    public static readonly DateTime Agora = new(2026, 10, 5, 8, 0, 0, DateTimeKind.Utc);
    public const int PacienteId = 10;
    public const int FarmaceuticoId = 1;
    public const int OperadorId = 2;
    public const int EntregadorId = 3;

    public static Medicamento Medicamento(int id, string nome, params (string Numero, int DiasValidade, int Quantidade)[] lotes)
    {
        var m = new Medicamento(nome, nome.ToLowerInvariant(), "50 mg", "comprimido", Tarja.Vermelha, false, 60);
        m.DefinirId(id);
        var loteId = id * 100;
        foreach (var (numero, dias, quantidade) in lotes)
            m.RegistrarEntrada(numero, Agora.AddMonths(-2), Agora.AddDays(dias), quantidade, Agora).DefinirId(++loteId);
        return m;
    }

    public static Medicamento Controlado(int id)
    {
        var m = new Medicamento("Clonazepam", "clonazepam", "2 mg", "comprimido", Tarja.Preta, true, 30);
        m.DefinirId(id);
        return m;
    }

    public static Tratamento Tratamento() => new(PacienteId, 1, Agora);

    public static Pedido Pedido(Tratamento tratamento) => new(PacienteId, tratamento, 1, "Rua das Acácias, 120 — São Paulo/SP", Agora);
}

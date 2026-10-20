using MedFlow.Domain.Comum;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Tests;

public class RegrasDiversasTests
{
    [Theory(DisplayName = "CT03 — Validação do CPF")]
    [InlineData("529.982.247-25", true)]
    [InlineData("52998224725", true)]
    [InlineData("529.982.247-24", false)]
    [InlineData("111.111.111-11", false)]
    [InlineData("123", false)]
    public void Cpf(string cpf, bool valido) => Assert.Equal(valido, CpfValidador.EhValido(cpf));

    [Fact(DisplayName = "CT08 — Cinco falhas de login bloqueiam a conta por 15 minutos")]
    public void BloqueioPorTentativas()
    {
        var u = new Usuario("Carlos Mendes", "carlos@email.com", "52998224725", "hash", PerfilUsuario.Paciente, null, Cenario.Agora);
        for (var i = 0; i < 4; i++) u.RegistrarFalhaLogin(Cenario.Agora);
        Assert.False(u.EstaBloqueado(Cenario.Agora));
        u.RegistrarFalhaLogin(Cenario.Agora);
        Assert.True(u.EstaBloqueado(Cenario.Agora.AddMinutes(14)));
        Assert.False(u.EstaBloqueado(Cenario.Agora.AddMinutes(16)));
    }

    [Fact(DisplayName = "CT15 — Medicamento de controle especial não entra na Box")]
    public void ControleEspecialBloqueado()
    {
        var t = Cenario.Tratamento();
        Assert.Throws<DomainException>(() => t.AdicionarSache(Cenario.Controlado(9), "22:00", 1));
    }

    [Theory(DisplayName = "CT16 — Quantidade por dose fora de 1 a 4 é rejeitada")]
    [InlineData(0)]
    [InlineData(5)]
    public void DoseInvalida(int quantidade)
    {
        var t = Cenario.Tratamento();
        Assert.Throws<DomainException>(() => t.AdicionarSache(Cenario.Medicamento(1, "Losartana"), "08:00", quantidade));
    }

    [Fact(DisplayName = "RN11 — Horário duplicado e formato inválido são rejeitados")]
    public void HorarioInvalido()
    {
        var t = Cenario.Tratamento();
        var med = Cenario.Medicamento(1, "Losartana");
        t.AdicionarSache(med, "08:00", 1);
        Assert.Throws<DomainException>(() => t.AdicionarSache(med, "08:00", 1));
        Assert.Throws<DomainException>(() => t.AdicionarSache(med, "8h", 1));
    }

    [Fact(DisplayName = "Necessidade do ciclo = soma das doses diárias × 30 dias")]
    public void NecessidadeDoCiclo()
    {
        var t = Cenario.Tratamento();
        var med = Cenario.Medicamento(1, "Metformina");
        t.AdicionarSache(med, "08:00", 1);
        t.AdicionarSache(med, "20:00", 2);
        Assert.Equal(90, t.NecessidadesDoCiclo(30).Single().Quantidade);
    }

    [Fact(DisplayName = "RN05 — Não é possível dar entrada em lote vencido")]
    public void EntradaLoteVencido()
    {
        var med = Cenario.Medicamento(1, "AAS");
        Assert.Throws<DomainException>(() => med.RegistrarEntrada("X1", Cenario.Agora.AddYears(-2), Cenario.Agora.AddDays(-1), 10, Cenario.Agora));
    }

    [Fact(DisplayName = "RN10 — Alerta quando o disponível fica igual ou abaixo do mínimo")]
    public void AlertaEstoqueMinimo()
    {
        var med = Cenario.Medicamento(1, "Atenolol", ("A1", 200, 40));
        Assert.True(med.AbaixoDoMinimo(Cenario.Agora));
    }

    [Fact(DisplayName = "CT23 — Recusa de receita exige motivo")]
    public void RecusaExigeMotivo()
    {
        var r = new Receita(Cenario.PacienteId, "a.pdf", "a.pdf", "application/pdf", 100, Cenario.Agora);
        Assert.Throws<DomainException>(() => r.Recusar(Cenario.FarmaceuticoId, " ", Cenario.Agora));
        r.Recusar(Cenario.FarmaceuticoId, "Receita sem assinatura do prescritor", Cenario.Agora);
        Assert.Equal(StatusReceita.Recusada, r.Status);
        Assert.False(r.PodeSerUsadaEm(Cenario.Agora));
        Assert.Throws<TransicaoInvalidaException>(() => r.Aprovar(Cenario.FarmaceuticoId, Cenario.Agora.AddDays(30), Cenario.Agora));
    }

    [Fact(DisplayName = "CT35 — Anonimização remove dados pessoais e impede login")]
    public void Anonimizacao()
    {
        var u = new Usuario("Carlos Mendes", "carlos@email.com", "52998224725", "hash", PerfilUsuario.Paciente, "Rua X, 10 — SP", Cenario.Agora);
        u.DefinirId(42);
        u.RegistrarConsentimento(TipoConsentimento.TermosDeUso, "2026.1", Cenario.Agora);
        u.Anonimizar(Cenario.Agora);
        Assert.Equal("Titular removido", u.Nome);
        Assert.Null(u.Endereco);
        Assert.Equal(string.Empty, u.SenhaHash);
        Assert.False(u.Ativo);
        Assert.All(u.Consentimentos, c => Assert.NotNull(c.RevogadoEm));
    }
}

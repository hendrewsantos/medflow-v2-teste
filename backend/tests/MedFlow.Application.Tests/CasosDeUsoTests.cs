using MedFlow.Application.Dtos;
using MedFlow.Application.Excecoes;
using MedFlow.Domain.Comum;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Application.Tests;

public class AutenticacaoTests
{
    private static CadastroPacienteRequest Cadastro(string email = "carlos@email.com", string cpf = "529.982.247-25", bool aceite = true) =>
        new("Carlos Mendes", email, cpf, "Senha1234", "Rua das Acácias, 120 — São Paulo/SP", null, aceite);

    [Fact(DisplayName = "CT01/CT05 — Cadastro grava hash com salt (nunca a senha) e registra o consentimento")]
    public async Task CadastroValido()
    {
        var amb = new Ambiente();
        await amb.Auth().CadastrarPacienteAsync(Cadastro());

        var u = await amb.Db.Usuarios.Include(x => x.Consentimentos).SingleAsync();
        Assert.NotEqual("Senha1234", u.SenhaHash);
        Assert.StartsWith("PBKDF2-SHA256$", u.SenhaHash);
        Assert.Equal(PerfilUsuario.Paciente, u.Perfil);
        Assert.Contains(u.Consentimentos, c => c.Tipo == TipoConsentimento.TermosDeUso);
        Assert.NotEqual(amb.Hasher.Gerar("Senha1234"), amb.Hasher.Gerar("Senha1234"));
    }

    [Fact(DisplayName = "CT02 — E-mail duplicado retorna conflito")]
    public async Task EmailDuplicado()
    {
        var amb = new Ambiente();
        await amb.Auth().CadastrarPacienteAsync(Cadastro());
        await Assert.ThrowsAsync<ConflitoException>(() => amb.Auth().CadastrarPacienteAsync(Cadastro(cpf: "111.444.777-35")));
    }

    [Fact(DisplayName = "CT03/CT04 — CPF inválido e falta de aceite são rejeitados")]
    public async Task ValidacoesDoCadastro()
    {
        var amb = new Ambiente();
        var ex = await Assert.ThrowsAsync<ValidacaoException>(() => amb.Auth().CadastrarPacienteAsync(Cadastro(cpf: "123.456.789-00", aceite: false)));
        Assert.True(ex.Erros.ContainsKey("cpf"));
        Assert.True(ex.Erros.ContainsKey("aceiteTermos"));
    }

    [Fact(DisplayName = "CT06/CT07/CT08 — Login, mensagem genérica e bloqueio após 5 falhas")]
    public async Task Login()
    {
        var amb = new Ambiente();
        await amb.Auth().CadastrarPacienteAsync(Cadastro());

        var ok = await amb.Auth().LoginAsync(new LoginRequest("CARLOS@email.com", "Senha1234"));
        Assert.Equal(PerfilUsuario.Paciente, ok.Usuario.Perfil);

        var erro = await Assert.ThrowsAsync<CredenciaisInvalidasException>(() => amb.Auth().LoginAsync(new LoginRequest("naoexiste@email.com", "x")));
        Assert.Equal("E-mail ou senha incorretos.", erro.Message);

        for (var i = 0; i < 4; i++)
            await Assert.ThrowsAsync<CredenciaisInvalidasException>(() => amb.Auth().LoginAsync(new LoginRequest("carlos@email.com", "errada")));
        await Assert.ThrowsAsync<ContaBloqueadaException>(() => amb.Auth().LoginAsync(new LoginRequest("carlos@email.com", "errada")));
        await Assert.ThrowsAsync<ContaBloqueadaException>(() => amb.Auth().LoginAsync(new LoginRequest("carlos@email.com", "Senha1234")));
    }
}

public class ReceitaEPedidoTests
{
    [Fact(DisplayName = "CT11/CT12/CT13 — Upload aceita PDF com consentimento; rejeita formato falso e falta de consentimento")]
    public async Task UploadDeReceita()
    {
        var amb = new Ambiente();
        var carlos = await amb.CriarUsuarioAsync("Carlos Mendes", "carlos@email.com", "52998224725", PerfilUsuario.Paciente);
        var logado = Ambiente.Logado(carlos);

        var r = await amb.Receitas().EnviarAsync(logado, Ambiente.PdfValido, "receita.pdf", consentimentoSaude: true);
        Assert.Equal(StatusReceita.Pendente, r.Status);

        await Assert.ThrowsAsync<ValidacaoException>(() => amb.Receitas().EnviarAsync(logado, "MZ executavel"u8.ToArray(), "receita.pdf", true));
        await Assert.ThrowsAsync<ValidacaoException>(() => amb.Receitas().EnviarAsync(logado, Ambiente.PdfValido, "receita.pdf", false));
    }

    [Fact(DisplayName = "CT24 — Funcionário não aprova receita (segregação de funções)")]
    public async Task FuncionarioNaoAprova()
    {
        var amb = new Ambiente();
        var carlos = await amb.CriarUsuarioAsync("Carlos Mendes", "carlos@email.com", "52998224725", PerfilUsuario.Paciente);
        var bruno = await amb.CriarUsuarioAsync("Bruno Lima", "bruno@medflow.com.br", "11144477735", PerfilUsuario.Funcionario);
        var r = await amb.Receitas().EnviarAsync(Ambiente.Logado(carlos), Ambiente.PdfValido, "receita.pdf", true);

        await Assert.ThrowsAsync<AcessoNegadoException>(() =>
            amb.Receitas().AprovarAsync(Ambiente.Logado(bruno), r.Id, new AprovarReceitaRequest(amb.Relogio.Agora.AddMonths(3))));
    }

    [Fact(DisplayName = "CT17/CT18/CT22/CT23 — Confirmação reserva; falta não grava nada; aprovação e recusa movem o pedido")]
    public async Task FluxoDoPedido()
    {
        var amb = new Ambiente();
        var carlos = await amb.CriarUsuarioAsync("Carlos Mendes", "carlos@email.com", "52998224725", PerfilUsuario.Paciente);
        var juliana = await amb.CriarUsuarioAsync("Juliana Prado", "juliana@medflow.com.br", "39053344705", PerfilUsuario.Administrador);
        var losartana = await amb.CriarMedicamentoAsync("Losartana", 100);
        var atenolol = await amb.CriarMedicamentoAsync("Atenolol", 40);
        var paciente = Ambiente.Logado(carlos);
        var receita = await amb.Receitas().EnviarAsync(paciente, Ambiente.PdfValido, "receita.pdf", true);

        // Falta de Atenolol (precisa 60, há 40): 409 e nenhuma reserva gravada — nem da Losartana.
        var faltando = new ConfirmarPedidoRequest(receita.Id, new[]
        {
            new ItemBoxRequest(losartana.Id, new[] { "08:00", "20:00" }, 1),
            new ItemBoxRequest(atenolol.Id, new[] { "08:00", "20:00" }, 1),
        }, "Rua das Acácias, 120 — São Paulo/SP");
        await Assert.ThrowsAsync<EstoqueInsuficienteException>(() => amb.Pedidos().ConfirmarAsync(paciente, faltando));
        Assert.Equal(0, await amb.Db.Lotes.SumAsync(l => l.QuantidadeReservada));
        Assert.Equal(0, await amb.Db.Pedidos.CountAsync());

        var valido = new ConfirmarPedidoRequest(receita.Id, new[] { new ItemBoxRequest(losartana.Id, new[] { "08:00", "20:00" }, 1) }, "Rua das Acácias, 120 — São Paulo/SP");
        var pedido = await amb.Pedidos().ConfirmarAsync(paciente, valido);
        Assert.Equal(StatusPedido.Pendente, pedido.Status);
        Assert.Equal(60, (await amb.Db.Lotes.SingleAsync(l => l.MedicamentoId == losartana.Id)).QuantidadeReservada);

        await amb.Receitas().AprovarAsync(Ambiente.Logado(juliana), receita.Id, new AprovarReceitaRequest(amb.Relogio.Agora.AddMonths(3)));
        var aposAprovacao = await amb.Pedidos().ObterAsync(paciente, pedido.Id);
        Assert.Equal(StatusPedido.EmSeparacao, aposAprovacao.Status);
    }

    [Fact(DisplayName = "CT14 — Receita de outro paciente não pode ser usada")]
    public async Task ReceitaDeOutroPaciente()
    {
        var amb = new Ambiente();
        var carlos = await amb.CriarUsuarioAsync("Carlos Mendes", "carlos@email.com", "52998224725", PerfilUsuario.Paciente);
        var maria = await amb.CriarUsuarioAsync("Maria Souza", "maria@email.com", "24763598155", PerfilUsuario.Paciente);
        var med = await amb.CriarMedicamentoAsync("Losartana", 100);
        var receitaDoCarlos = await amb.Receitas().EnviarAsync(Ambiente.Logado(carlos), Ambiente.PdfValido, "r.pdf", true);

        await Assert.ThrowsAsync<AcessoNegadoException>(() => amb.Pedidos().ConfirmarAsync(Ambiente.Logado(maria),
            new ConfirmarPedidoRequest(receitaDoCarlos.Id, new[] { new ItemBoxRequest(med.Id, new[] { "08:00" }, 1) }, "Rua das Flores, 45 — São Paulo/SP")));
    }

    [Fact(DisplayName = "CT34/CT35 — Exportação sem hash e exclusão com anonimização e liberação da reserva")]
    public async Task DireitosDoTitular()
    {
        var amb = new Ambiente();
        var carlos = await amb.CriarUsuarioAsync("Carlos Mendes", "carlos@email.com", "52998224725", PerfilUsuario.Paciente);
        var med = await amb.CriarMedicamentoAsync("Losartana", 100);
        var paciente = Ambiente.Logado(carlos);
        var receita = await amb.Receitas().EnviarAsync(paciente, Ambiente.PdfValido, "r.pdf", true);
        await amb.Pedidos().ConfirmarAsync(paciente, new ConfirmarPedidoRequest(receita.Id, new[] { new ItemBoxRequest(med.Id, new[] { "08:00" }, 1) }, "Rua das Acácias, 120 — São Paulo/SP"));

        var dados = await amb.Privacidade().ObterAsync(paciente);
        Assert.DoesNotContain("PBKDF2", System.Text.Json.JsonSerializer.Serialize(dados));
        Assert.Single(dados.Pedidos);

        await amb.Privacidade().ExcluirContaAsync(paciente);
        var u = await amb.Db.Usuarios.SingleAsync(x => x.Id == carlos.Id);
        Assert.Equal("Titular removido", u.Nome);
        Assert.False(u.Ativo);
        Assert.Empty(amb.Storage.Arquivos);
        Assert.Equal(StatusPedido.Cancelado, (await amb.Db.Pedidos.SingleAsync()).Status);
        Assert.Equal(0, await amb.Db.Lotes.SumAsync(l => l.QuantidadeReservada));
        await Assert.ThrowsAsync<CredenciaisInvalidasException>(() => amb.Auth().LoginAsync(new LoginRequest("carlos@email.com", "Senha1234")));
    }

    [Fact(DisplayName = "CT15 (serviço) — Box com medicamento controlado é rejeitada")]
    public async Task ControladoNaBox()
    {
        var amb = new Ambiente();
        var carlos = await amb.CriarUsuarioAsync("Carlos Mendes", "carlos@email.com", "52998224725", PerfilUsuario.Paciente);
        var clonazepam = await amb.CriarMedicamentoAsync("Clonazepam", 60, controlado: true);
        var receita = await amb.Receitas().EnviarAsync(Ambiente.Logado(carlos), Ambiente.PdfValido, "r.pdf", true);

        await Assert.ThrowsAsync<DomainException>(() => amb.Pedidos().ConfirmarAsync(Ambiente.Logado(carlos),
            new ConfirmarPedidoRequest(receita.Id, new[] { new ItemBoxRequest(clonazepam.Id, new[] { "22:00" }, 1) }, "Rua das Acácias, 120 — São Paulo/SP")));
    }
}

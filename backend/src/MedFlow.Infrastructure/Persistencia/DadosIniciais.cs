using System.Text;
using MedFlow.Application.Abstracoes;
using MedFlow.Domain.Entidades;
using MedFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedFlow.Infrastructure.Persistencia;

/// <summary>
/// Dados de demonstração (somente em Development). Cria o banco se não existir e popula usuários,
/// catálogo com lotes e uma receita aprovada para o paciente de teste exercitar o fluxo de renovação.
/// </summary>
public static class DadosIniciais
{
    public const string SenhaDemonstracao = "MedFlow2026";

    public static async Task AplicarAsync(AppDbContext db, IPasswordHasher hasher, IArquivoStorage storage, DateTime agora, CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        if (await db.Usuarios.AnyAsync(ct)) return;

        Usuario NovoUsuario(string nome, string email, string cpf, PerfilUsuario perfil, string? endereco = null) =>
            new(nome, email, cpf, hasher.Gerar(SenhaDemonstracao), perfil, endereco, agora);

        var juliana = NovoUsuario("Juliana Prado (Farmacêutica RT)", "juliana@medflow.com.br", "529.982.247-25", PerfilUsuario.Administrador);
        var bruno = NovoUsuario("Bruno Lima", "bruno@medflow.com.br", "111.444.777-35", PerfilUsuario.Funcionario);
        var rafael = NovoUsuario("Rafael Souza", "rafael@medflow.com.br", "390.533.447-05", PerfilUsuario.Entregador);
        var carlos = NovoUsuario("Carlos Mendes", "carlos@email.com", "247.635.981-55", PerfilUsuario.Paciente,
            "Rua das Acácias, 120 — Vila Mariana, São Paulo/SP — 04101-000");
        carlos.RegistrarConsentimento(TipoConsentimento.TermosDeUso, "2026.1", agora);
        carlos.RegistrarConsentimento(TipoConsentimento.DadosDeSaude, "2026.1", agora);
        db.Usuarios.AddRange(juliana, bruno, rafael, carlos);

        var hoje = agora.Date;
        Medicamento Med(string nome, string principio, string concentracao, string forma, Tarja tarja, int minimo, bool controlado = false) =>
            new(nome, principio, concentracao, forma, tarja, controlado, minimo);

        var losartana = Med("Losartana potássica", "losartana potássica", "50 mg", "comprimido", Tarja.Vermelha, 120);
        losartana.RegistrarEntrada("LOS2611", hoje.AddMonths(-4), hoje.AddMonths(8), 180, agora);
        losartana.RegistrarEntrada("LOS2702", hoje.AddMonths(-1), hoje.AddMonths(14), 300, agora);

        var metformina = Med("Metformina", "cloridrato de metformina", "850 mg", "comprimido", Tarja.Vermelha, 120);
        metformina.RegistrarEntrada("MET2533", hoje.AddMonths(-20), hoje.AddDays(20), 90, agora);   // vence antes do fim do ciclo: não é reservado (RN04)
        metformina.RegistrarEntrada("MET2609", hoje.AddMonths(-2), hoje.AddMonths(10), 400, agora);

        var sinvastatina = Med("Sinvastatina", "sinvastatina", "20 mg", "comprimido", Tarja.Vermelha, 60);
        sinvastatina.RegistrarEntrada("SIN2604", hoje.AddMonths(-3), hoje.AddMonths(12), 240, agora);

        var aas = Med("AAS", "ácido acetilsalicílico", "100 mg", "comprimido", Tarja.Livre, 60);
        aas.RegistrarEntrada("AAS2610", hoje.AddMonths(-2), hoje.AddMonths(9), 300, agora);

        var omeprazol = Med("Omeprazol", "omeprazol", "20 mg", "cápsula", Tarja.Vermelha, 60);
        omeprazol.RegistrarEntrada("OME2608", hoje.AddMonths(-5), hoje.AddMonths(7), 150, agora);

        var levotiroxina = Med("Levotiroxina sódica", "levotiroxina sódica", "50 mcg", "comprimido", Tarja.Vermelha, 60);
        levotiroxina.RegistrarEntrada("LEV2612", hoje.AddMonths(-1), hoje.AddMonths(11), 200, agora);

        var atenolol = Med("Atenolol", "atenolol", "25 mg", "comprimido", Tarja.Vermelha, 60);
        atenolol.RegistrarEntrada("ATE2603", hoje.AddMonths(-6), hoje.AddMonths(6), 40, agora);       // abaixo do mínimo: gera alerta

        var hidroclorotiazida = Med("Hidroclorotiazida", "hidroclorotiazida", "25 mg", "comprimido", Tarja.Vermelha, 60);
        hidroclorotiazida.RegistrarEntrada("HCT2607", hoje.AddMonths(-2), hoje.AddMonths(10), 180, agora);

        var anlodipino = Med("Anlodipino", "besilato de anlodipino", "5 mg", "comprimido", Tarja.Vermelha, 60);
        anlodipino.RegistrarEntrada("ANL2611", hoje.AddMonths(-1), hoje.AddMonths(12), 240, agora);

        var clonazepam = Med("Clonazepam", "clonazepam", "2 mg", "comprimido", Tarja.Preta, 30, controlado: true);
        clonazepam.RegistrarEntrada("CLO2605", hoje.AddMonths(-3), hoje.AddMonths(9), 60, agora);

        var medicamentos = new[] { losartana, metformina, sinvastatina, aas, omeprazol, levotiroxina, atenolol, hidroclorotiazida, anlodipino, clonazepam };
        db.Medicamentos.AddRange(medicamentos);
        await db.SaveChangesAsync(ct);

        foreach (var lote in medicamentos.SelectMany(m => m.Lotes))
            db.Movimentacoes.Add(new MovimentacaoEstoque(lote, TipoMovimentacao.Entrada, lote.QuantidadeFisica, null, juliana.Id, agora, "Carga inicial de demonstração."));

        // Receita de demonstração já aprovada: permite testar o fluxo de renovação (pedido vai direto para separação).
        var pdf = Encoding.ASCII.GetBytes("%PDF-1.4\n% Receita de demonstração MedFlow\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
        var caminho = await storage.SalvarAsync(pdf, ".pdf", ct);
        var receita = new Receita(carlos.Id, caminho, "receita-carlos.pdf", "application/pdf", pdf.Length, agora.AddDays(-10));
        receita.Aprovar(juliana.Id, hoje.AddMonths(5), agora.AddDays(-9));
        db.Receitas.Add(receita);
        await db.SaveChangesAsync(ct);
    }
}

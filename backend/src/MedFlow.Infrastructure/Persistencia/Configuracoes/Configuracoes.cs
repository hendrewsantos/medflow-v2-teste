using MedFlow.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedFlow.Infrastructure.Persistencia.Configuracoes;

// Enums gravados como texto: o banco fica legível em consultas (ex.: status = 'EmSeparacao').

internal sealed class UsuarioConfig : IEntityTypeConfiguration<Usuario>
{
    public void Configure(EntityTypeBuilder<Usuario> b)
    {
        b.ToTable("usuarios");
        b.Property(x => x.Nome).HasMaxLength(150).IsRequired();
        b.Property(x => x.Email).HasMaxLength(150).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.Property(x => x.Cpf).HasMaxLength(14).IsRequired();
        b.HasIndex(x => x.Cpf).IsUnique();
        b.Property(x => x.SenhaHash).HasMaxLength(200).IsRequired();
        b.Property(x => x.Perfil).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Endereco).HasMaxLength(255);
        b.Property(x => x.Telefone).HasMaxLength(20);
        b.HasMany(x => x.Consentimentos).WithOne().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Consentimentos).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class ConsentimentoConfig : IEntityTypeConfiguration<Consentimento>
{
    public void Configure(EntityTypeBuilder<Consentimento> b)
    {
        b.ToTable("consentimentos");
        b.Property(x => x.Tipo).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.VersaoTermo).HasMaxLength(20).IsRequired();
    }
}

internal sealed class ReceitaConfig : IEntityTypeConfiguration<Receita>
{
    public void Configure(EntityTypeBuilder<Receita> b)
    {
        b.ToTable("receitas");
        b.HasOne(x => x.Paciente).WithMany().HasForeignKey(x => x.PacienteId).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.CaminhoArquivo).HasMaxLength(255);
        b.Property(x => x.NomeOriginal).HasMaxLength(255).IsRequired();
        b.Property(x => x.TipoConteudo).HasMaxLength(50).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.MotivoRecusa).HasMaxLength(500);
        b.HasIndex(x => x.Status);
    }
}

internal sealed class MedicamentoConfig : IEntityTypeConfiguration<Medicamento>
{
    public void Configure(EntityTypeBuilder<Medicamento> b)
    {
        b.ToTable("medicamentos");
        b.Property(x => x.Nome).HasMaxLength(150).IsRequired();
        b.Property(x => x.PrincipioAtivo).HasMaxLength(150).IsRequired();
        b.Property(x => x.Concentracao).HasMaxLength(50).IsRequired();
        b.Property(x => x.FormaFarmaceutica).HasMaxLength(50).IsRequired();
        b.Property(x => x.Tarja).HasConversion<string>().HasMaxLength(20);
        b.Ignore(x => x.QuantidadeFisica);
        b.Ignore(x => x.QuantidadeReservada);
        b.HasMany(x => x.Lotes).WithOne(l => l.Medicamento).HasForeignKey(l => l.MedicamentoId).OnDelete(DeleteBehavior.Restrict);
        b.Navigation(x => x.Lotes).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class LoteConfig : IEntityTypeConfiguration<Lote>
{
    public void Configure(EntityTypeBuilder<Lote> b)
    {
        b.ToTable("lotes");
        b.Property(x => x.Numero).HasMaxLength(40).IsRequired();
        b.HasIndex(x => new { x.MedicamentoId, x.Numero }).IsUnique();
        b.HasIndex(x => x.Validade);
        // Concorrência otimista: UPDATE ... WHERE Versao = @original. Se outro pedido reservou antes, nada é gravado.
        b.Property(x => x.Versao).IsConcurrencyToken();
        b.Ignore(x => x.Disponivel);
    }
}

internal sealed class TratamentoConfig : IEntityTypeConfiguration<Tratamento>
{
    public void Configure(EntityTypeBuilder<Tratamento> b)
    {
        b.ToTable("tratamentos");
        b.HasOne<Usuario>().WithMany().HasForeignKey(x => x.PacienteId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Receita>().WithMany().HasForeignKey(x => x.ReceitaId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Saches).WithOne().HasForeignKey(s => s.TratamentoId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Saches).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class SacheConfig : IEntityTypeConfiguration<Sache>
{
    public void Configure(EntityTypeBuilder<Sache> b)
    {
        b.ToTable("saches");
        b.Property(x => x.Horario).HasMaxLength(5).IsRequired();
        b.HasOne(x => x.Medicamento).WithMany().HasForeignKey(x => x.MedicamentoId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PedidoConfig : IEntityTypeConfiguration<Pedido>
{
    public void Configure(EntityTypeBuilder<Pedido> b)
    {
        b.ToTable("pedidos");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.EnderecoEntrega).HasMaxLength(255).IsRequired();
        b.Ignore(x => x.ValidoAte);
        b.Ignore(x => x.EntregaAtual);
        b.HasOne(x => x.Paciente).WithMany().HasForeignKey(x => x.PacienteId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Tratamento).WithMany().HasForeignKey(x => x.TratamentoId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Receita>().WithMany().HasForeignKey(x => x.ReceitaId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Itens).WithOne().HasForeignKey(i => i.PedidoId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Historico).WithOne().HasForeignKey(h => h.PedidoId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Entregas).WithOne().HasForeignKey(e => e.PedidoId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Itens).UsePropertyAccessMode(PropertyAccessMode.Field);
        b.Navigation(x => x.Historico).UsePropertyAccessMode(PropertyAccessMode.Field);
        b.Navigation(x => x.Entregas).UsePropertyAccessMode(PropertyAccessMode.Field);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.PacienteId);
    }
}

internal sealed class PedidoItemConfig : IEntityTypeConfiguration<PedidoItem>
{
    public void Configure(EntityTypeBuilder<PedidoItem> b)
    {
        b.ToTable("pedido_itens");
        b.HasOne(x => x.Medicamento).WithMany().HasForeignKey(x => x.MedicamentoId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Alocacoes).WithOne().HasForeignKey(a => a.PedidoItemId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Alocacoes).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class AlocacaoLoteConfig : IEntityTypeConfiguration<AlocacaoLote>
{
    public void Configure(EntityTypeBuilder<AlocacaoLote> b)
    {
        b.ToTable("alocacoes_lote");
        b.HasOne(x => x.Lote).WithMany().HasForeignKey(x => x.LoteId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class HistoricoPedidoConfig : IEntityTypeConfiguration<HistoricoPedido>
{
    public void Configure(EntityTypeBuilder<HistoricoPedido> b)
    {
        b.ToTable("historico_pedidos");
        b.Property(x => x.De).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Para).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Observacao).HasMaxLength(500);
    }
}

internal sealed class EntregaConfig : IEntityTypeConfiguration<Entrega>
{
    public void Configure(EntityTypeBuilder<Entrega> b)
    {
        b.ToTable("entregas");
        b.Property(x => x.Resultado).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Recebedor).HasMaxLength(150);
        b.Property(x => x.Ocorrencia).HasMaxLength(500);
        b.HasOne<Usuario>().WithMany().HasForeignKey(x => x.EntregadorId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class MovimentacaoConfig : IEntityTypeConfiguration<MovimentacaoEstoque>
{
    public void Configure(EntityTypeBuilder<MovimentacaoEstoque> b)
    {
        b.ToTable("movimentacoes_estoque");
        b.Property(x => x.Tipo).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Observacao).HasMaxLength(255);
        b.HasOne(x => x.Lote).WithMany().HasForeignKey(x => x.LoteId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Pedido).WithMany().HasForeignKey(x => x.PedidoId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.Em);
    }
}

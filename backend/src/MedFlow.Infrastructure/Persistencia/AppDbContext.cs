using MedFlow.Application.Abstracoes;
using MedFlow.Domain.Entidades;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace MedFlow.Infrastructure.Persistencia;

public sealed class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Consentimento> Consentimentos => Set<Consentimento>();
    public DbSet<Receita> Receitas => Set<Receita>();
    public DbSet<Medicamento> Medicamentos => Set<Medicamento>();
    public DbSet<Lote> Lotes => Set<Lote>();
    public DbSet<MovimentacaoEstoque> Movimentacoes => Set<MovimentacaoEstoque>();
    public DbSet<Tratamento> Tratamentos => Set<Tratamento>();
    public DbSet<Pedido> Pedidos => Set<Pedido>();
    public DbSet<Entrega> Entregas => Set<Entrega>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    /// <summary>
    /// Todas as datas são gravadas e lidas como UTC. Sem isso o MySQL devolve DateTime "Unspecified",
    /// o JSON sai sem o "Z" e o navegador mostra o horário deslocado em 3 horas.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcNullableConverter>();
    }

    private sealed class UtcConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcConverter() : base(
            v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc)) { }
    }

    private sealed class UtcNullableConverter : ValueConverter<DateTime?, DateTime?>
    {
        public UtcNullableConverter() : base(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v) { }
    }
}

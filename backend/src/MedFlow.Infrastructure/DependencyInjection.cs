using MedFlow.Application.Abstracoes;
using MedFlow.Infrastructure.Arquivos;
using MedFlow.Infrastructure.Persistencia;
using MedFlow.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MedFlow.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuracao)
    {
        var conexao = configuracao.GetConnectionString("MedFlow")
            ?? throw new InvalidOperationException("Configure ConnectionStrings:MedFlow (variável de ambiente ConnectionStrings__MedFlow).");

        services.AddDbContext<AppDbContext>(o => o.UseMySql(conexao, new MySqlServerVersion(new Version(8, 0, 36)),
            mysql => mysql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddSingleton<IRelogio, RelogioSistema>();
        services.AddSingleton<IPasswordHasher>(_ => new PasswordHasherPbkdf2());
        services.Configure<JwtOptions>(configuracao.GetSection(JwtOptions.Secao));
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.Configure<ArmazenamentoOptions>(configuracao.GetSection("Armazenamento"));
        services.AddSingleton<IArquivoStorage, ArquivoStorageLocal>();
        services.Configure<OpcoesLgpd>(configuracao.GetSection("Lgpd"));
        return services;
    }
}

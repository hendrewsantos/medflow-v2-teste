using MedFlow.Application.Servicos;
using Microsoft.Extensions.DependencyInjection;

namespace MedFlow.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<AuthService>();
        services.AddScoped<UsuarioService>();
        services.AddScoped<PrivacidadeService>();
        services.AddScoped<ReceitaService>();
        services.AddScoped<CatalogoService>();
        services.AddScoped<PedidoService>();
        services.AddScoped<EntregaService>();
        services.AddScoped<PainelService>();
        return services;
    }
}

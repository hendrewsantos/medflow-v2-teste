using MedFlow.Application.Abstracoes;

namespace MedFlow.Infrastructure.Seguranca;

public sealed class RelogioSistema : IRelogio
{
    public DateTime Agora => DateTime.UtcNow;
}

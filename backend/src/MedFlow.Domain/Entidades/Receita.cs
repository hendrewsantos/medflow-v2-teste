using MedFlow.Domain.Comum;
using MedFlow.Domain.Enums;

namespace MedFlow.Domain.Entidades;

public sealed class Receita : Entidade
{
    private Receita() { }

    public Receita(int pacienteId, string caminhoArquivo, string nomeOriginal, string tipoConteudo, long tamanhoBytes, DateTime agora)
    {
        PacienteId = pacienteId;
        CaminhoArquivo = caminhoArquivo;
        NomeOriginal = nomeOriginal;
        TipoConteudo = tipoConteudo;
        TamanhoBytes = tamanhoBytes;
        EnviadaEm = agora;
        Status = StatusReceita.Pendente;
    }

    public int PacienteId { get; private set; }
    public Usuario? Paciente { get; private set; }
    public string CaminhoArquivo { get; private set; } = string.Empty;
    public string NomeOriginal { get; private set; } = string.Empty;
    public string TipoConteudo { get; private set; } = string.Empty;
    public long TamanhoBytes { get; private set; }
    public DateTime EnviadaEm { get; private set; }
    public StatusReceita Status { get; private set; }
    public int? AnalisadaPorId { get; private set; }
    public DateTime? AnalisadaEm { get; private set; }
    public DateTime? ValidaAte { get; private set; }
    public string? MotivoRecusa { get; private set; }

    /// <summary>RN02 — a receita pode sustentar um pedido se estiver pendente de análise ou aprovada e dentro da validade.</summary>
    public bool PodeSerUsadaEm(DateTime agora) =>
        Status == StatusReceita.Pendente || (Status == StatusReceita.Aprovada && ValidaAte.HasValue && ValidaAte.Value.Date >= agora.Date);

    public void Aprovar(int farmaceuticoId, DateTime validaAte, DateTime agora)
    {
        GarantirPendente();
        if (validaAte.Date < agora.Date) throw new DomainException("A validade da receita não pode ser anterior à data da análise.");
        Status = StatusReceita.Aprovada;
        ValidaAte = validaAte.Date;
        AnalisadaPorId = farmaceuticoId;
        AnalisadaEm = agora;
    }

    public void Recusar(int farmaceuticoId, string motivo, DateTime agora)
    {
        GarantirPendente();
        if (string.IsNullOrWhiteSpace(motivo) || motivo.Trim().Length < 5)
            throw new DomainException("Informe o motivo da recusa (mínimo de 5 caracteres).");
        Status = StatusReceita.Recusada;
        MotivoRecusa = motivo.Trim();
        AnalisadaPorId = farmaceuticoId;
        AnalisadaEm = agora;
    }

    /// <summary>Usado na exclusão de conta: o arquivo é apagado e a referência removida.</summary>
    public void RemoverArquivo() => CaminhoArquivo = string.Empty;

    private void GarantirPendente()
    {
        if (Status != StatusReceita.Pendente)
            throw new TransicaoInvalidaException($"Esta receita já foi analisada (status atual: {Status}).");
    }
}

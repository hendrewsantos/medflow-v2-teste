using MedFlow.Application.Abstracoes;
using Microsoft.Extensions.Options;

namespace MedFlow.Infrastructure.Arquivos;

public sealed class ArmazenamentoOptions
{
    /// <summary>Pasta FORA do wwwroot: receitas nunca ficam acessíveis por URL pública (RNF04).</summary>
    public string PastaReceitas { get; set; } = "storage/receitas";
}

public sealed class ArquivoStorageLocal : IArquivoStorage
{
    private readonly string _pasta;

    public ArquivoStorageLocal(IOptions<ArmazenamentoOptions> opcoes)
    {
        _pasta = Path.GetFullPath(opcoes.Value.PastaReceitas);
        Directory.CreateDirectory(_pasta);
    }

    public async Task<string> SalvarAsync(byte[] conteudo, string extensao, CancellationToken ct)
    {
        // Nome gerado pelo sistema: o nome enviado pelo usuário nunca vira caminho no disco.
        var nome = $"{Guid.NewGuid():N}{extensao}";
        await File.WriteAllBytesAsync(Path.Combine(_pasta, nome), conteudo, ct);
        return nome;
    }

    public async Task<byte[]?> LerAsync(string caminho, CancellationToken ct)
    {
        var arquivo = CaminhoSeguro(caminho);
        return arquivo is not null && File.Exists(arquivo) ? await File.ReadAllBytesAsync(arquivo, ct) : null;
    }

    public Task ExcluirAsync(string caminho, CancellationToken ct)
    {
        var arquivo = CaminhoSeguro(caminho);
        if (arquivo is not null && File.Exists(arquivo)) File.Delete(arquivo);
        return Task.CompletedTask;
    }

    /// <summary>Impede path traversal ("../"): aceita apenas um nome de arquivo dentro da pasta configurada.</summary>
    private string? CaminhoSeguro(string caminho)
    {
        if (string.IsNullOrWhiteSpace(caminho) || Path.GetFileName(caminho) != caminho) return null;
        return Path.Combine(_pasta, caminho);
    }
}

using System.Security.Cryptography;
using MedFlow.Application.Abstracoes;

namespace MedFlow.Infrastructure.Seguranca;

/// <summary>
/// RNF01 — "hash com salt": PBKDF2-HMAC-SHA256, salt aleatório de 16 bytes por senha e 600.000 iterações
/// (recomendação OWASP). Formato gravado: PBKDF2-SHA256$iteracoes$salt(base64)$hash(base64).
/// Usa apenas a biblioteca padrão do .NET (System.Security.Cryptography).
/// </summary>
public sealed class PasswordHasherPbkdf2 : IPasswordHasher
{
    private const string Algoritmo = "PBKDF2-SHA256";
    private const int TamanhoSalt = 16;
    private const int TamanhoHash = 32;
    public const int IteracoesPadrao = 600_000;

    private readonly int _iteracoes;

    public PasswordHasherPbkdf2(int iteracoes = IteracoesPadrao) => _iteracoes = iteracoes;

    public string Gerar(string senha)
    {
        var salt = RandomNumberGenerator.GetBytes(TamanhoSalt);
        var hash = Rfc2898DeriveBytes.Pbkdf2(senha, salt, _iteracoes, HashAlgorithmName.SHA256, TamanhoHash);
        return $"{Algoritmo}${_iteracoes}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verificar(string senha, string armazenado)
    {
        if (string.IsNullOrEmpty(armazenado)) return false;
        var partes = armazenado.Split('$');
        if (partes.Length != 4 || partes[0] != Algoritmo || !int.TryParse(partes[1], out var iteracoes) || iteracoes <= 0) return false;

        byte[] salt, esperado;
        try
        {
            salt = Convert.FromBase64String(partes[2]);
            esperado = Convert.FromBase64String(partes[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var calculado = Rfc2898DeriveBytes.Pbkdf2(senha, salt, iteracoes, HashAlgorithmName.SHA256, esperado.Length);
        // Comparação em tempo constante: não vaza, pelo tempo de resposta, quantos bytes coincidiram.
        return CryptographicOperations.FixedTimeEquals(calculado, esperado);
    }
}

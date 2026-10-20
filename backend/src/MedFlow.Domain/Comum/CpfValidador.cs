namespace MedFlow.Domain.Comum;

/// <summary>Validação dos dígitos verificadores do CPF (módulo 11).</summary>
public static class CpfValidador
{
    public static string Normalizar(string? cpf) => new((cpf ?? string.Empty).Where(char.IsDigit).ToArray());

    public static bool EhValido(string? cpf)
    {
        var d = Normalizar(cpf);
        if (d.Length != 11 || d.Distinct().Count() == 1) return false;

        int Digito(int tamanho)
        {
            var soma = 0;
            for (var i = 0; i < tamanho; i++) soma += (d[i] - '0') * (tamanho + 1 - i);
            var resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }

        return Digito(9) == d[9] - '0' && Digito(10) == d[10] - '0';
    }

    /// <summary>Mascara o CPF para listagens (minimização de dados — LGPD).</summary>
    public static string Mascarar(string? cpf)
    {
        var d = Normalizar(cpf);
        return d.Length == 11 ? $"***.***.{d.Substring(6, 3)}-{d.Substring(9, 2)}" : "***";
    }
}

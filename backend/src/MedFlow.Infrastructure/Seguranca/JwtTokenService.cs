using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MedFlow.Application.Abstracoes;
using MedFlow.Domain.Entidades;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace MedFlow.Infrastructure.Seguranca;

public sealed class JwtOptions
{
    public const string Secao = "Jwt";
    public string Emissor { get; set; } = "MedFlow.Api";
    public string Audiencia { get; set; } = "MedFlow.Web";
    /// <summary>Chave HMAC com no mínimo 32 caracteres. Em produção vem de variável de ambiente (Jwt__Chave).</summary>
    public string Chave { get; set; } = string.Empty;
    public int ExpiracaoMinutos { get; set; } = 60;
}

/// <summary>RNF03 — token JWT assinado (HS256) com o perfil do usuário na claim de papel (role).</summary>
public sealed class JwtTokenService : ITokenService
{
    private readonly JwtOptions _opcoes;
    private readonly IRelogio _relogio;

    public JwtTokenService(IOptions<JwtOptions> opcoes, IRelogio relogio)
    {
        _opcoes = opcoes.Value;
        _relogio = relogio;
        if (Encoding.UTF8.GetByteCount(_opcoes.Chave) < 32)
            throw new InvalidOperationException("Jwt:Chave precisa ter pelo menos 32 caracteres (256 bits). Configure a variável de ambiente Jwt__Chave.");
    }

    public TokenGerado Gerar(Usuario usuario)
    {
        var agora = _relogio.Agora;
        var expira = agora.AddMinutes(_opcoes.ExpiracaoMinutos);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Name, usuario.Nome),
            new Claim(ClaimTypes.Role, usuario.Perfil.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        var credenciais = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opcoes.Chave)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(_opcoes.Emissor, _opcoes.Audiencia, claims, notBefore: agora, expires: expira, signingCredentials: credenciais);
        return new TokenGerado(new JwtSecurityTokenHandler().WriteToken(token), expira);
    }
}

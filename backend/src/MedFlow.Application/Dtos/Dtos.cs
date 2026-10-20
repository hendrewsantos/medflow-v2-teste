using MedFlow.Domain.Enums;

namespace MedFlow.Application.Dtos;

// ── Autenticação e conta ──
public sealed record CadastroPacienteRequest(string Nome, string Email, string Cpf, string Senha, string Endereco, string? Telefone, bool AceiteTermos);
public sealed record LoginRequest(string Email, string Senha);
public sealed record UsuarioResumo(int Id, string Nome, string Email, string CpfMascarado, PerfilUsuario Perfil, bool Ativo);
public sealed record AuthResponse(string Token, DateTime ExpiraEm, UsuarioResumo Usuario);
public sealed record CriarUsuarioInternoRequest(string Nome, string Email, string Cpf, string Senha, PerfilUsuario Perfil);

// ── LGPD (art. 18) ──
public sealed record AtualizarMeusDadosRequest(string Nome, string Email, string? Endereco, string? Telefone);
public sealed record ConsentimentoDto(TipoConsentimento Tipo, string VersaoTermo, DateTime ConcedidoEm, DateTime? RevogadoEm);
public sealed record MeusDadosDto(
    int Id, string Nome, string Email, string Cpf, string? Endereco, string? Telefone, DateTime CriadoEm,
    IReadOnlyList<ConsentimentoDto> Consentimentos,
    IReadOnlyList<ReceitaDto> Receitas,
    IReadOnlyList<PedidoResumoDto> Pedidos);

// ── Receitas ──
public sealed record ReceitaDto(int Id, int PacienteId, string? Paciente, string NomeOriginal, string TipoConteudo, long TamanhoBytes,
    DateTime EnviadaEm, StatusReceita Status, DateTime? ValidaAte, string? MotivoRecusa, DateTime? AnalisadaEm);
public sealed record AprovarReceitaRequest(DateTime ValidaAte);
public sealed record RecusarReceitaRequest(string Motivo);

// ── Catálogo e estoque ──
public sealed record MedicamentoRequest(string Nome, string PrincipioAtivo, string Concentracao, string FormaFarmaceutica, Tarja Tarja, bool ControleEspecial, int NivelMinimo);
public sealed record LoteDto(int Id, string Numero, DateTime Fabricacao, DateTime Validade, int QuantidadeFisica, int QuantidadeReservada, int Disponivel, bool Vencido);
public sealed record MedicamentoDto(int Id, string Nome, string PrincipioAtivo, string Concentracao, string FormaFarmaceutica, Tarja Tarja,
    bool ControleEspecial, int NivelMinimo, int QuantidadeFisica, int QuantidadeReservada, int DisponivelParaCiclo, bool AbaixoDoMinimo,
    IReadOnlyList<LoteDto> Lotes);
public sealed record EntradaLoteRequest(string Numero, DateTime Fabricacao, DateTime Validade, int Quantidade);
public sealed record MovimentacaoDto(int Id, string Medicamento, string Lote, TipoMovimentacao Tipo, int Quantidade, int? PedidoId, DateTime Em, string Observacao);
public sealed record AlertaDto(string Tipo, string Medicamento, string Mensagem, string Severidade);

// ── Box e pedidos ──
public sealed record ItemBoxRequest(int MedicamentoId, IReadOnlyList<string> Horarios, int DosePorHorario);
public sealed record ConfirmarPedidoRequest(int ReceitaId, IReadOnlyList<ItemBoxRequest> Itens, string EnderecoEntrega);
public sealed record DisponibilidadeItemDto(int MedicamentoId, string Medicamento, int Necessario, int Disponivel, bool Atende);
public sealed record SimulacaoDto(bool PodeConfirmar, IReadOnlyList<DisponibilidadeItemDto> Itens);
public sealed record AlocacaoDto(string Lote, DateTime Validade, int Quantidade);
public sealed record PedidoItemDto(int MedicamentoId, string Medicamento, int Quantidade, IReadOnlyList<string> Horarios, int DosePorHorario, IReadOnlyList<AlocacaoDto> Lotes);
public sealed record HistoricoDto(StatusPedido? De, StatusPedido Para, DateTime Em, string? Observacao);
public sealed record EntregaDto(int Tentativa, int EntregadorId, DateTime IniciadaEm, DateTime? ConcluidaEm, ResultadoEntrega Resultado, string? Recebedor, string? Ocorrencia);
public sealed record PedidoResumoDto(int Id, string Paciente, StatusPedido Status, DateTime CriadoEm, DateTime AtualizadoEm, int TotalItens);
public sealed record PedidoDto(int Id, int PacienteId, string Paciente, int ReceitaId, StatusPedido Status, string EnderecoEntrega, int DiasCiclo,
    DateTime CriadoEm, DateTime AtualizadoEm, IReadOnlyList<PedidoItemDto> Itens, IReadOnlyList<HistoricoDto> Historico, IReadOnlyList<EntregaDto> Entregas);
public sealed record ConfirmarEntregaRequest(string Recebedor);
public sealed record OcorrenciaRequest(string Motivo);

// ── Painel ──
public sealed record IndicadoresDto(
    IReadOnlyDictionary<StatusPedido, int> PedidosPorStatus,
    int ReceitasPendentes,
    int MedicamentosAbaixoDoMinimo,
    int LotesVencendo30Dias,
    int LotesVencidos,
    double? TempoCicloP90Horas,
    double? PercentualPrimeiraTentativa,
    int PedidosParadosEmSeparacao);

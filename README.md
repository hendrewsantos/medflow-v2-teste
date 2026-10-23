# MedFlow Solutions · v2 (repositório de teste)

Recriação do sistema do PIM III (UNIP · ADS) a partir da **especificação de requisitos revisada (ISO/IEC/IEEE 29148)**,
dos **casos de uso**, dos **diagramas de sequência** e dos **casos de teste** do documento que acompanha este repositório.
É um repositório separado: o repositório original do grupo não foi alterado.

> A dose certa, no horário certo, sem interromper o tratamento.
> O paciente envia a receita e monta a Box; a farmacêutica valida; a equipe separa com rastreio de lote; o entregador leva até a porta.

## O que mudou em relação à versão do PIM

| Problema encontrado na revisão | Como a v2 resolve | Requisito |
|---|---|---|
| Senha gravada em texto puro (`SenhaHash = dto.Senha`) | PBKDF2-SHA256, salt de 16 bytes por senha, 600.000 iterações | RNF01 |
| Perfil enviado pelo navegador no cabeçalho `X-User-Id` (falsificável) | JWT assinado (HS256, 60 min) + `[Authorize(Policy)]` em cada endpoint | RNF03, RN01 |
| Baixa de estoque na criação do tratamento, sem transação, ignorando falta | Reserva na confirmação, "tudo ou nada", com concorrência otimista por lote | RN03, RN06 |
| Tratamento aceito com receita pendente/recusada | Receita obrigatória; separação só após aprovação humana | RN02 |
| Status do pedido como texto livre | Máquina de estados com transições permitidas e histórico | RN08, RN13 |
| Lote e validade misturados no cadastro do medicamento | Entidade `Lote`, reserva por FEFO e bloqueio de lote vencido | RN04, RN05 |
| Endpoints que devolviam CPF e hash; senha do banco no `appsettings.json` | DTOs sem hash, CPF mascarado, segredos em variáveis de ambiente | RNF04, RNF12 |
| Direitos da LGPD só para o Administrador | Acesso, correção, exportação e exclusão pelo próprio titular | RF19, RN16 |

## Estrutura

```
backend/                     ASP.NET Core 8 — Clean Architecture
  src/MedFlow.Domain         Entidades e regras puras (sem dependências): Pedido, Lote, Receita, FEFO…
  src/MedFlow.Application    Casos de uso (serviços), DTOs e contratos
  src/MedFlow.Infrastructure EF Core + MySQL (Pomelo), PBKDF2, JWT, arquivos de receita
  src/MedFlow.Api            Controllers finos, JWT, CORS, limite de tentativas, Swagger
  tests/                     xUnit: domínio (regras) e aplicação (banco em memória)
frontend/                    Vue 3 + Vite + Pinia + Vue Router + Axios
  src/domain/regras.js       As mesmas regras do domínio em JavaScript
  src/services/http.js       Cliente da API (JWT no cabeçalho Authorization)
  src/services/mock/         Servidor de demonstração em memória (modo protótipo)
  tests/                     Testes das regras e dos fluxos (node --test, sem dependências)
prototipo/                   Gera o protótipo navegável em um único HTML a partir das mesmas regras
docs/                        Especificação (ERS ISO/IEC/IEEE 29148), casos de uso, diagramas e casos de teste (Word e PDF)
```

## Abrir o protótipo (sem instalar nada)

- **No computador:** abra `docs/MedFlow_Prototipo.html` com dois cliques (Chrome, Edge ou Firefox). Entre com uma das pessoas de exemplo.
- **Pelo GitHub (link para a banca):** no repositório, vá em *Settings → Pages*, escolha *Deploy from a branch*,
  branch `main` e pasta `/docs`, e salve. Em alguns minutos o protótipo abre em
  `https://SEU-USUARIO.github.io/medflow-v2-teste/` (o arquivo `docs/index.html` é o próprio protótipo).
  No plano gratuito do GitHub, o Pages só funciona com repositório público.

## Como rodar

**Pré-requisitos:** .NET 8 SDK, MySQL 8, Node.js 20+.

### API

```bash
cd backend
# 1) informe a conexão e a chave do JWT (nunca no código):
dotnet user-secrets init --project src/MedFlow.Api
dotnet user-secrets set "ConnectionStrings:MedFlow" "server=localhost;port=3306;database=medflow_v2;user=root;password=SUA_SENHA" --project src/MedFlow.Api
dotnet user-secrets set "Jwt:Chave" "uma-chave-longa-com-pelo-menos-32-caracteres" --project src/MedFlow.Api
# 2) rode (em Development o banco é criado e populado com dados de exemplo):
dotnet run --project src/MedFlow.Api
# Swagger: https://localhost:7205/swagger
dotnet test        # testes do domínio e da aplicação
```

Ou, com Docker: `docker compose up --build` (MySQL + API na porta 8080).

### Front-end

```bash
cd frontend
npm install
npm run dev        # usa a API em VITE_API_URL (veja .env.example)
npm run dev:demo   # usa o servidor de demonstração, sem API nem banco
npm test           # 21 testes de regras de negócio e fluxos (node --test, sem dependências)
```

### Contas de exemplo (Development e modo demonstração)

| Perfil | E-mail | Senha |
|---|---|---|
| Paciente | carlos@email.com | MedFlow2026 |
| Farmacêutica RT (Administrador) | juliana@medflow.com.br | MedFlow2026 |
| Operador (Funcionário) | bruno@medflow.com.br | MedFlow2026 |
| Entregador | rafael@medflow.com.br | MedFlow2026 |

## O que foi verificado e o que falta verificar

- **Testado:** regras de negócio em JavaScript e fluxos completos do servidor de demonstração (21 testes aprovados, `npm test`);
  protótipo navegável percorrido de ponta a ponta no navegador nos quatro perfis, em desktop e celular, tema claro, escuro e alto contraste.
- **Escrito, a executar:** 34 métodos de teste xUnit (domínio e aplicação), `dotnet test`.
- **Não compilado no ambiente em que foi gerado:** o back-end C# (sem acesso ao SDK .NET/NuGet) e os componentes `.vue`
  (sem acesso ao npm). O código segue as APIs padrão do .NET 8 e do Vue 3, mas rode `dotnet build`, `dotnet test`
  e `npm run build` antes de apresentar e corrija qualquer ajuste pontual que o compilador apontar.

## Rastreabilidade

Cada classe de serviço e cada teste cita o caso de uso (UCxx), o requisito (RFxx/RNFxx), a regra (RNxx) e o caso de teste (CTxx)
correspondentes do documento de especificação.

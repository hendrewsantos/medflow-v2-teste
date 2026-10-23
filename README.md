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

Há três jeitos. Escolha **um**. Os comandos são para o PowerShell (no Windows) ou qualquer terminal.

| Quero... | Preciso instalar | Seção |
|---|---|---|
| Ver o sistema completo (front + back + banco) com poucos comandos | Docker Desktop e Node.js 20+ | **A** |
| Ver o sistema completo, sem Docker | .NET 8 SDK, MySQL 8 e Node.js 20+ | **B** |
| Só a interface, com dados simulados (sem API nem banco) | Node.js 20+ | **C** |

### A) Sistema completo com Docker (recomendado)

Abra o Docker Desktop e espere ele ficar "Running". Depois, **no terminal 1**, na raiz do projeto:

```bash
docker compose up --build
```

A primeira vez demora (baixa o MySQL e compila a API). Quando aparecer `Now listening on: http://[::]:8080`, a API está no ar
(Swagger em http://localhost:8080/swagger). Deixe esse terminal aberto.

**No terminal 2**, na raiz do projeto:

```bash
cd frontend
"VITE_API_URL=http://localhost:8080/api" | Out-File -Encoding ascii .env.local   # PowerShell
npm install
npm run dev
```

No Linux/macOS, troque a linha do `.env.local` por: `echo "VITE_API_URL=http://localhost:8080/api" > .env.local`

Abra **http://localhost:5173** e entre com uma das contas da tabela abaixo.
Para parar: `Ctrl+C` nos dois terminais e `docker compose down`.

### B) Sistema completo sem Docker

Com o MySQL 8 rodando, **no terminal 1**:

```bash
cd backend
dotnet user-secrets init --project src/MedFlow.Api
dotnet user-secrets set "ConnectionStrings:MedFlow" "server=localhost;port=3306;database=medflow_v2;user=root;password=SUA_SENHA" --project src/MedFlow.Api
dotnet run --project src/MedFlow.Api
```

Troque `SUA_SENHA` pela senha do seu MySQL. Em Development o banco é criado e populado sozinho. A API abre em
https://localhost:7205/swagger (se o navegador reclamar do certificado: `dotnet dev-certs https --trust`).

**No terminal 2:**

```bash
cd frontend
npm install
npm run dev
```

Abra **http://localhost:5173**. Aqui não precisa criar o `.env.local`: o padrão já aponta para `https://localhost:7205/api`.

### C) Só o front-end (modo demonstração)

```bash
cd frontend
npm install
npm run dev:demo
```

Abra **http://localhost:5173**. Os dados são simulados em memória e voltam ao estado inicial ao recarregar a página.

### Testes

```bash
cd backend ; dotnet test       # 34 testes de domínio e de aplicação (xUnit)
cd ../frontend ; npm test      # 21 testes de regras de negócio e fluxos (node --test)
```

### Contas de exemplo (Development e modo demonstração)

Só existem para teste: são criadas automaticamente quando a API roda em Development (ou no modo demonstração) e não são criadas em produção.
Mesmo assim a senha é gravada como hash (PBKDF2), nunca em texto puro.

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

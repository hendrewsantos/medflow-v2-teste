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

Há quatro jeitos. Escolha **um**. Os comandos são para o PowerShell (Windows); em Linux/macOS funcionam iguais, exceto onde indicado.

| Quero... | Preciso instalar | Seção |
|---|---|---|
| Ver tudo (front + back + banco) com o mínimo de comandos | Docker Desktop e Node.js 20+ | **A** |
| Ver tudo, com a API rodando fora do Docker (e só o banco no Docker) | Docker Desktop, .NET 8 SDK e Node.js 20+ | **B** |
| Ver tudo, **sem Docker nenhum** (ex.: notebook de outra pessoa) | .NET 8 SDK, MySQL 8 e Node.js 20+ | **C** |
| Só a interface, com dados simulados (sem API nem banco) | Node.js 20+ | **D** |

**Antes de tudo — a pasta certa.** Todos os comandos partem da pasta que contém o `docker-compose.yml`, o `backend` e o `frontend`.
Se você baixou o `.zip`, é comum haver uma pasta `medflow-v2-teste` dentro de outra `medflow-v2-teste`: entre na de dentro
(`cd medflow-v2-teste`) e confira com `ls`. Em terminal novo, comece sempre com o `cd` do caminho completo da pasta.

### A) Tudo no Docker (banco e API) + front

Abra o Docker Desktop e espere ele ficar "Running". **Terminal 1**, na raiz do projeto:

```powershell
docker compose up --build
```

A primeira vez demora (baixa o MySQL e compila a API). Quando aparecer `Now listening on: http://[::]:8080`, a API está no ar
(Swagger em http://localhost:8080/swagger). Deixe esse terminal aberto. Se o contêiner `api` estiver parado no Docker Desktop, é só iniciá-lo.

**Terminal 2**, na raiz do projeto:

```powershell
cd frontend
"VITE_API_URL=http://localhost:8080/api" | Out-File -Encoding ascii .env.local
npm install
npm run dev
```

No Linux/macOS, troque a linha do `.env.local` por: `echo "VITE_API_URL=http://localhost:8080/api" > .env.local`

Abra **http://localhost:5173** (Chrome ou Edge) e entre com uma das contas da tabela mais abaixo.
Para parar: `Ctrl+C` no terminal do front e `docker compose down`.

### B) API com `dotnet run` e só o MySQL no Docker

Indicado quando o MySQL instalado no Windows tem senha desconhecida, ou quando você quer ver os logs da API direto no terminal.
Se já tiver usado o método A, rode `docker compose down` antes. O MySQL do Docker fica na porta **3307** do seu computador
(a 3306 costuma estar ocupada por um MySQL instalado no Windows).

**Terminal 1**, na raiz do projeto:

```powershell
docker compose up mysql -d
docker compose ps
```

Espere o status ficar `(healthy)` (uns 20 a 30 segundos). Só então vá para o terminal 2.

**Terminal 2:**

```powershell
cd backend
dotnet user-secrets set "ConnectionStrings:MedFlow" "server=localhost;port=3307;database=medflow_v2;user=root;password=troque-esta-senha" --project src/MedFlow.Api
dotnet dev-certs https --trust
dotnet run --project src/MedFlow.Api
```

- `troque-esta-senha` é a senha padrão do `docker-compose.yml` (variável `MYSQL_ROOT_PASSWORD`). Se você definiu outra, use a sua.
- `dotnet dev-certs https --trust` só é necessário na primeira vez (aparece uma janela do Windows: clique em **Sim**).
- Em Development a API cria o banco e as contas de exemplo sozinha. Quando aparecer `Now listening on: https://localhost:7205`, está pronta
  (Swagger em https://localhost:7205/swagger). Deixe esse terminal aberto.

**Terminal 3:**

```powershell
cd frontend
Test-Path .env.local
npm install
npm run dev
```

O `Test-Path` precisa responder `False`. Se responder `True`, apague com `Remove-Item .env.local` (esse arquivo é do método A e
faria o front procurar a API na porta 8080). Aqui não precisa criar nada: o padrão já aponta para `https://localhost:7205/api`.

Abra **http://localhost:5173** e entre com uma das contas da tabela mais abaixo.

Para encerrar: `Ctrl+C` nos terminais 2 e 3. Depois `docker compose down` apaga o banco (na próxima vez ele nasce limpo, com as contas de exemplo)
ou `docker compose stop` guarda os dados; para retomar, `docker compose start mysql`.

### C) Sem Docker nenhum (MySQL instalado na máquina)

Precisa de **.NET 8 SDK**, **Node.js 20+** e **MySQL 8** instalados, com um usuário e senha que você conheça. Confira se o serviço do MySQL está rodando.

**Terminal 1:**

```powershell
cd backend
dotnet user-secrets set "ConnectionStrings:MedFlow" "server=localhost;port=3306;database=medflow_v2;user=root;password=SUA_SENHA" --project src/MedFlow.Api
dotnet dev-certs https --trust
dotnet run --project src/MedFlow.Api
```

Troque `SUA_SENHA` pela senha do seu MySQL (a porta padrão é 3306; se o seu MySQL usa outra, troque também). O banco `medflow_v2` é criado e populado sozinho.
A API abre em https://localhost:7205/swagger.

**Terminal 2:** igual ao terminal 3 do método B (`cd frontend`, `Test-Path .env.local` deve dar `False`, `npm install`, `npm run dev`).
Abra **http://localhost:5173**.

### D) Só o front-end (modo demonstração)

```powershell
cd frontend
npm install
npm run dev:demo
```

Abra **http://localhost:5173**. Os dados são simulados em memória e voltam ao estado inicial ao recarregar a página.
Sem instalar nada, também dá para abrir `docs/MedFlow_Prototipo.html` com dois cliques.

### Problemas comuns

| Mensagem ou sintoma | Causa | O que fazer |
|---|---|---|
| `no configuration file provided: not found` | Terminal na pasta errada (fora do projeto ou na pasta de fora do zip) | `cd` para a pasta que tem o `docker-compose.yml` |
| `port is already allocated` (3306) | Outro MySQL usando a 3306 | O compose já usa **3307** no host; confira se o `docker-compose.yml` está atualizado |
| `Could not find the global property 'UserSecretsId'` | Projeto sem o identificador de segredos | `dotnet user-secrets init --project src/MedFlow.Api` e repita o `set` |
| `Access denied for user 'root'` / `ERROR 1045` | Senha da connection string diferente da senha do MySQL | Use `troque-esta-senha` com o MySQL do Docker (porta 3307) ou a senha do seu MySQL (porta 3306) |
| `Unable to connect to any of the specified MySQL hosts` | MySQL ainda iniciando ou parado | `docker compose ps` e espere `(healthy)`; no método C, inicie o serviço do MySQL |
| Navegador reclama do certificado da API | Certificado de desenvolvimento não confiável | `dotnet dev-certs https --trust` |
| Login do front dá erro de rede | API desligada, ou `.env.local` apontando para a porta 8080 com a API na 7205 | Confirme que a API está de pé; nos métodos B e C apague o `.env.local` e reinicie o `npm run dev` |
| `http://localhost:5173` abre dentro do VS Code e fica ruim de usar | Navegador embutido do editor | Copie o endereço e abra no Chrome ou Edge |
| `MSB1009: Arquivo de projeto não existe` | Comando rodado fora da pasta `backend` | `cd backend` na pasta certa e repita |

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
- **Executado em máquina Windows:** a API compila e sobe pelo Docker (método A) e pelo `dotnet run` com MySQL 8 no Docker (método B);
  o banco é criado e populado automaticamente, o Swagger abre e a tela de login do front-end carrega.
- **A executar:** `dotnet test` (34 métodos xUnit), `npm run build` e o percurso completo (receita, Box, separação, entrega) com a API real.
  Qualquer ajuste pontual que o compilador ou os testes apontarem deve ser corrigido antes de apresentar.

## Rastreabilidade

Cada classe de serviço e cada teste cita o caso de uso (UCxx), o requisito (RFxx/RNFxx), a regra (RNxx) e o caso de teste (CTxx)
correspondentes do documento de especificação.

# Identificação

- **Nome:** Hendrew dos Santos Braz
- **RA:** H76FBE0
- **Turma:** DS4Q40

## Comandos usados

Primeiro conferi a versão do .NET instalada e rodei os dois projetos:

```powershell
dotnet --list-sdks                  # apareceu o SDK 8.0.419
dotnet run --project EfLab
dotnet run --project PipelineLab
```

Depois salvei as saídas em arquivos pelo PowerShell, para usar como evidência:

```powershell
dotnet run --project EfLab | Out-File -Encoding utf8 ef_saida.txt
dotnet run --project PipelineLab | Out-File -Encoding utf8 pipe_limite1.txt   # rodando com limite 1
dotnet run --project PipelineLab | Out-File -Encoding utf8 pipe_limite2.txt   # rodando com limite 2
Get-Content ... | Out-File -Append evidencias.txt                              # juntei tudo em um arquivo só
```

## Respostas C1–C5

**C1. Onde a consulta é executada? O que muda se materializar antes de filtrar?**

A consulta roda no banco de dados, e não no C#. O EF pega o LINQ e transforma em SQL, e dá para ver isso pelo `ToQueryString()`, que mostrou o `WHERE`, o `JOIN` e o `ORDER BY` no SQL gerado.

Se eu chamar o `ToListAsync()` antes do `Where`, o EF traz todos os pedidos do banco para a memória e só depois o filtro é feito no C#. Com isso vêm linhas e colunas que nem vão ser usadas, e o filtro deixa de ser feito pelo banco, que é quem consegue usar os índices.

**C2. Por que AsNoTracking é útil? Por que a projeção escalar já não rastreia entidades?**

Por padrão, o DbContext guarda as entidades que ele leu para saber o que mudou na hora do `SaveChanges()`. Quando a consulta é só para leitura, isso gasta memória e processamento sem necessidade, e o `AsNoTracking()` desliga esse controle. Na execução, a consulta da entidade `Pedido` deixou 1 entidade rastreada, e com `AsNoTracking()` ficou 0.

Já na projeção (`new { p.Id, Cliente, ... }`) o resultado não é uma entidade, é um objeto anônimo só com valores. Então o EF não tem o que rastrear, e por isso apareceu "Rastreados na projeção: 0".

**C3. Diferença entre Endereco e Detalhes (armazenamento e SQL)**

A diferença está em como cada um é salvo no banco:

- **Endereco** é um tipo complexo. Os campos dele viram colunas na própria tabela `Clientes` (`Endereco_UF`, `Endereco_Cidade`).
- **Detalhes** é um tipo owned mapeado para JSON. Tudo fica em uma coluna só (`Detalhes`) na tabela `Pedidos`, em formato JSON.

Isso muda o SQL do filtro. No Endereco ele compara a coluna direto. No Detalhes o SQL precisa entrar no JSON e pegar o campo pelo caminho:

- Filtro em Endereco: `AND "c"."Endereco_UF" = 'SP'`
- Filtro em Detalhes: `WHERE "p"."Detalhes" ->> 'Canal' = 'Web'`

**C4. Quando o produtor espera? Diferença entre capacidade da fila e limite do semáforo**

O produtor espera quando o Channel, que é limitado, está cheio. Como ele foi configurado com `FullMode.Wait`, o `WriteAsync` fica aguardando até um consumidor tirar um item e abrir espaço. Isso é o backpressure: o produtor é segurado quando os consumidores não estão dando conta.

Na minha execução (capacidade 4 e 4 consumidores), os itens 1 a 8 esperaram 0 ms, e a espera de uns 120 ms começou no item 9. Pelo que entendi, isso acontece porque 4 itens ficam com os consumidores e outros 4 cabem na fila, então o 9º já não tem lugar.

A capacidade da fila controla quantos itens podem ficar esperando dentro do Channel. O limite do semáforo controla quantos consumidores podem usar o recurso ao mesmo tempo. Um cuida da fila e o outro cuida do acesso ao recurso, então são partes diferentes do fluxo.

**C5. Por que não compartilhar o mesmo DbContext? Como escolher um limite?**

Porque o DbContext não é thread-safe. Ele não aceita duas operações ao mesmo tempo, e quando isso acontece dá o erro "A second operation was started". Então cada consumidor precisa ter o seu próprio DbContext, e mesmo assim tem que dar `await` em cada operação antes de usar o contexto de novo.

Para escolher o limite, eu olharia quanto o banco aguenta, o tamanho do pool de conexões e o fato de que outras rotas do sistema também usam o banco. Não dá para deixar todas as conexões só para os workers. Outro ponto é que o semáforo só funciona dentro de um processo: se tiver mais de uma instância do servidor rodando, cada uma tem o seu semáforo, e ele não controla o total.

## Alteração autoral: previsão e resultado

Na minha alteração, filtrei os pedidos **pendentes** com `TotalCentavos >= 13000`.

**Previsão (antes de rodar):** achei que iam aparecer só os pedidos 6 e 3 (18000 e 15000), porque:

- o pedido 1 (12000) e o 4 (9000) ficam abaixo do mínimo;
- o pedido 5 (20000) tem valor suficiente, mas está Pago, e o filtro é só de pendentes.

**Resultado da execução:**

```
6 | Carla | SP | 18000
3 | Bruno | RJ | 15000
```

A previsão bateu com a saída.

Também anotei o resultado das consultas da atividade A:

- **A.1** (pendentes >= 9000): IDs 6, 3, 1 e 4.
- **A.2** (agrupado por UF): RJ = 15000 e SP = 39000. MG não aparece porque o Diego só tem o pedido 5, que está Pago.
- **A.3** (adicionando `Canal == "Web"`): sobraram 6, 3 e 1. O pedido 4 saiu porque o canal dele é Balcao.

## Experimentos: limite 1 e limite 2

Configuração: 20 trabalhos, capacidade 4, 4 consumidores e `FullMode.Wait`. Rodei duas vezes, mudando só o limite do semáforo.

| | Limite 1 | Limite 2 |
|---|---|---|
| Concluídos | 20/20 | 20/20 |
| Únicos | 20 | 20 |
| Pico no recurso | 1 | 2 |
| IDs | 1 a 20 | 1 a 20 |

Nas duas execuções nenhum trabalho se perdeu nem foi processado duas vezes, e o pico de uso do recurso nunca passou do limite configurado.

O que mudou foi a espera do produtor. Com limite 1, quase todos os envios a partir do item 9 esperaram uns 120 ms. Com limite 2, a espera apareceu alternada (125 ms, 0 ms, 123 ms, 0 ms...), porque agora dois itens terminam juntos e liberam duas vagas na fila de uma vez.

Mas como foram só duas execuções, não dá para afirmar que o limite 2 é mais rápido. Também reparei que a ordem em que os trabalhos terminam muda de uma execução para outra, mas isso não é problema, porque todos foram concluídos certinho.

## Dificuldade e solução

Quando fui gerar o `evidencias.txt`, a saída do PipelineLab ficou com o acento quebrado (aparecia "Conclu├¡dos" em vez de "Concluídos"). O problema era a codificação que o PowerShell estava usando para gravar o arquivo. Resolvi configurando o console para UTF-8:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

Depois gerei os arquivos de novo e conferi com `Select-String` se tinha ficado certo. Apareceu "Concluídos: 20/20".

Também tive um erro quando colei um comando grande no terminal: veio junto um caractere a mais (^B) e o comando falhou. Resolvi dividindo em comandos menores e rodando um de cada vez.

# Nome do cliente na notinha, com histórico

Data: 2026-07-20

Continua o trabalho de [2026-07-19-notinha-do-cliente-design.md](2026-07-19-notinha-do-cliente-design.md),
que criou a notinha de orçamento exportável.

## Problema

A notinha do cliente hoje diz o que é a peça e quanto custa, mas não diz **pra
quem** é. Chega no WhatsApp como um papel genérico. Uma criança vendendo pros
colegas manda o mesmo orçamento pra várias pessoas no mesmo dia, e um orçamento
endereçado é mais fácil de reconhecer — e mais bonito de receber.

Além disso, ela vende repetidamente pras mesmas pessoas. Redigitar "Maria" toda
vez é atrito que não precisa existir.

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| O nome fica salvo na peça? | **Não.** O campo começa vazio toda vez. A mesma peça é orçada pra pessoas diferentes; nome grudado na peça vira envio errado |
| Onde aparece na notinha? | **No topo, tipo carta** — abaixo de "orçamento", antes do tracejado |
| Existe histórico de clientes? | **Sim** |
| Onde o histórico mora? | **Supabase**, como o resto do app |
| Como ela reusa um cliente? | **Pastilhas clicáveis** com os 6 mais recentes |

Descartado de propósito: autocompletar nativo (`<datalist>` — inconsistente no
celular e indescobrível pra criança), lista suspensa (um toque a mais e some da
vista), e botão de apagar cliente (ver "Sem apagar" abaixo).

## O campo e as pastilhas

Ficam **acima** do canvas, para ela digitar e ver a notinha mudar logo abaixo,
na hora. Ordem de leitura: pergunta → notinha → botão de mandar.

```
Pra quem é?
┌──────────────────────────────┐
│ Maria                        │
└──────────────────────────────┘
( Maria ) ( João ) ( Vovó ) ( Pedro )
      ↑ toca e o campo preenche
```

- Rótulo: **"Pra quem é?"** — mesma voz interrogativa das outras telas
  ("Qual é o nome do seu produto?", "Quais cores você usou?").
- Placeholder: `Ex: Maria`.
- Estilo do campo seguindo `app/novo/page.tsx`: `rounded-2xl border-2
  border-borda bg-painel2 ... outline-none focus:border-neon`.
- `maxLength` de 24 caracteres.
- Pastilhas: os **6 clientes mais recentes**, mais novo primeiro, altura mínima
  de 48px. Sem clientes, a fileira não é renderizada — nada de "nenhum cliente
  cadastrado" ocupando espaço.
- O campo é **opcional**. Vazio, a notinha não mostra linha nenhuma — nada de
  "PARA:" pendurado sem nome.

## Na notinha desenhada

```
   ★ LOJA DA JULIA ★
       orçamento
      PARA MARIA        ← só existe se ela digitar
 - - - - - - - - - - - -
   DINOSSAURO ROXO
   Roxo + Verde
      ┌──────────┐
      │  PREÇO   │
      │ R$ 25,00 │
      └──────────┘
  orçamento de 19/07/2026
```

Em caixa alta, na tinta escura do papel (`--papel-tinta`), mais forte que o
"orçamento" acinzentado logo acima — porque é conteúdo, não rótulo.

Nome que não couber na largura do papel é cortado com reticências pela
`quebrarEmLinhas` já existente, com `maxLinhas: 1`. O `maxLength` do campo é a
primeira barreira; o corte no desenho é a segunda.

## Quando o nome é salvo

**No momento de exportar**, dentro do `exportar()` do `NotinhaCliente` — nunca
enquanto digita. Salvar a cada tecla criaria "M", "Ma", "Mar", "Mari", "Maria":
cinco clientes de mentira.

**Um cliente igual não vira dois.** O `id` da linha é o nome normalizado
(minúsculo, `trim`, espaços internos colapsados), enquanto a coluna `nome`
guarda a grafia original pra exibir na pastilha. "maria", "Maria" e " MARIA "
são a mesma linha. Reenviar pra Maria não cria linha nova — só atualiza
`usado_em`, que é o que ordena as pastilhas.

**Sem apagar.** Como só as 6 mais recentes aparecem, um "Marai" digitado errado
cai da lista sozinho conforme ela usa nomes de verdade. Um X em cada pastilha,
pra criança, é mais toque acidental do que utilidade. A linha continua no banco,
inofensiva.

## A regra que não se quebra

**Salvar o cliente nunca pode atrapalhar o envio.** Supabase fora do ar,
assinatura vencida, rede caída — a notinha vai pro WhatsApp do mesmo jeito e o
histórico é que fica pra trás. Gravar é conveniência; mandar é o ponto.

Concretamente: `usarCliente()` é chamado sem travar o envio e sua falha vai só
pro `console.error`, **nunca pro `Dialogo`**. A promessa de exportar não espera
por ela e não é rejeitada por ela.

Mesma lógica na leitura: se `lerClientes()` falhar, as pastilhas não aparecem e
o campo de digitar continua funcionando. A ausência do histórico degrada a
comodidade, não a função.

## O banco

`supabase/schema.sql`, acrescentado **no fim do arquivo**, idempotente, no mesmo
estilo do resto. Segue exatamente o padrão de `produtos`: `primary key
(user_id, id)`, RLS ligada, quatro políticas separadas, INSERT travado em
`assinatura_ativa()`.

```sql
create table if not exists public.clientes (
  id        text not null,        -- nome normalizado: "maria"
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome      text not null,        -- como ela escreveu: "Maria"
  usado_em  timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists clientes_usuario_uso
  on public.clientes (user_id, usado_em desc);

alter table public.clientes enable row level security;

drop policy if exists "dono ve clientes" on public.clientes;
drop policy if exists "dono edita clientes" on public.clientes;
drop policy if exists "dono apaga clientes" on public.clientes;
drop policy if exists "cria cliente com assinatura" on public.clientes;

create policy "dono ve clientes" on public.clientes
  for select using (auth.uid() = user_id);
create policy "dono edita clientes" on public.clientes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga clientes" on public.clientes
  for delete using (auth.uid() = user_id);
create policy "cria cliente com assinatura" on public.clientes
  for insert with check (auth.uid() = user_id and public.assinatura_ativa());
```

O `id` ser o nome normalizado é o que permite `upsert` com
`onConflict: "user_id,id"` — o padrão já usado em `salvarCor` e `salvarConfig`.
Sem isso, deduplicar exigiria índice único em expressão (`lower(nome)`), que o
PostgREST não consegue mirar num upsert.

**Aviso:** `supabase/schema.sql` tem alterações não commitadas no momento em que
este spec foi escrito. A migração entra no fim do arquivo sem tocar no trecho
pendente, mas vale conferir antes de rodar no Supabase.

## Arquitetura

### `lib/clientes.ts` (criar) — normalização, pura

```ts
export interface Cliente {
  id: string;
  nome: string;
  usadoEm: number;
}

/** "  MARIA   SILVA " → "maria silva" (id da linha) */
export function idDoCliente(nome: string): string;

/** "  Maria   Silva " → "Maria Silva" (o que aparece na pastilha e na notinha) */
export function nomeLimpo(nome: string): string;
```

As duas colapsam espaço interno, não só as pontas. Se `nomeLimpo` só fizesse
`trim`, "Maria Silva" e "Maria  Silva" cairiam no MESMO `id` (que colapsa) com
`nome` diferente, e a pastilha mudaria de grafia sozinha a cada envio.

`nomeLimpo` também é o que vai pro desenho: o canvas centraliza o texto, então
espaço sobrando deslocaria a linha visivelmente.

**Nome que normaliza pra vazio não é cliente.** `idDoCliente("   ")` devolve
`""`, e `usarCliente` não faz nada nesse caso — sem linha de id vazio no banco.

Sem DOM, testável no Vitest. É aqui que mora a regra "um cliente igual não vira
dois".

### `lib/db.ts` (modificar) — duas funções novas

```ts
export async function lerClientes(): Promise<Cliente[]>;  // usado_em desc, limit 12
export async function usarCliente(nome: string): Promise<void>;  // upsert; no-op se o nome normalizar pra vazio
```

Buscamos 12 e mostramos 6: sobra folga se alguma linha vier estranha, sem pagar
uma segunda ida ao banco.

### `lib/orcamento.ts` (modificar)

`DadosOrcamento` ganha `cliente: string` (`""` = sem linha). `montarOrcamento`
devolve `cliente: ""` — o nome não vem do produto, vem do que ela digitar.

`textoDaNotinha` passa a incluir o cliente quando houver, pro leitor de tela
descrever a notinha inteira.

**O teste que trava a lista fechada de campos passa de 5 pra 6 chaves,
continuando fechado** (`toEqual`, não "contém"). É essa rigidez que faz um campo
de custo quebrar o teste no dia que alguém acrescentar.

### `lib/notinha-desenho.ts` (modificar)

Um bloco condicional a mais em `percorrer()`, no mesmo formato do bloco de
`cores` que já existe: desenha só se `dados.cliente` não for vazio, e o `y`
avança fora do `if (pintar)` pras duas passadas continuarem em sincronia.

### `components/NotinhaCliente.tsx` (modificar)

Passa a guardar o nome digitado e a lista de clientes. Combina o `dados` que vem
da página com o nome local via `useMemo` antes de desenhar — a página de
resultado continua sem saber que isso existe.

## Verificação

- Vitest em `lib/clientes.test.ts`: normalização (maiúscula, espaço nas pontas,
  espaço interno duplicado, string vazia, nome só de espaços), e que
  `idDoCliente` colapsa para o mesmo id o que `nomeLimpo` exibe igual.
- Vitest em `lib/orcamento.test.ts`: a lista fechada de campos, agora com 6.
- Print com Playwright em 1440/820/390 via rota `/preview` temporária: com nome,
  sem nome, e com nome no limite dos 24 caracteres. **Desfazer a rota depois.**
- Conferir manualmente que exportar com o Supabase inacessível ainda baixa a
  notinha (o caminho de "salvar não atrapalha mandar").

## Limitação aceita

Um cliente digitado errado fica no banco pra sempre; só some da vista. Aceito
conscientemente em troca de não ter UI de apagar numa tela usada por criança.

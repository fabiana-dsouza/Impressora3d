# Fase 1 — a nota como a primeira venda do produto novo

**Data:** 2026-08-05
**Status:** Aprovado em conversa (aguardando implementação)

## Enquadramento

A `/resultado` no modo orçamento não é "uma tela de negociar preço". Ela é onde
a criança **fecha a primeira venda de um produto que acabou de criar pra um
cliente** (em geral, um cliente novo). Ela montou a peça *porque* alguém pediu,
então o fim natural da criação é vender pra essa pessoa. Ajustar o preço (o
verde/vermelho de ganha/perde) é só um pedaço desse caminho — **não** um passo
cerimonial chamado "negociação".

Escopo desta fase: **só a `/resultado`**. A `/novo` continua igual (cria a peça
com `precoVenda: 0` e entrega pra `/resultado?...&novo=1&cores=...`). A revenda
de produtos já existentes (o gate "Mudou algo?", "Vendido N vezes") é a **Fase
2**, desenhada depois.

## Ordem nova da tela (modo orçamento)

```
[ X entrou na fábrica! Bora vender pro seu cliente? ]   ← só quando vem da /novo

1. Qual cor dessa vez?        (seletor de cor — como já está)
2. Por quanto você vai vender? (o valor, ajustável, com ganha/perde ao lado)
3. As duas notinhas ao vivo    [só sua] [pro cliente ← dá pra mandar]

4. Fechou a venda?
   [ Vendido por R$ 12,00 ]   [ Só orçamento ]
        │                          │
        │                          └─► volta pra fábrica (a notinha do cliente
        ▼                              já estava ali pra mandar)
5. Pra quem é?   (aparece só agora: campo + clientes recentes, com foco)
   [ Confirmar venda ] ─► "Já te pagou?" ─► Vendidos (🎉) / Falta receber
```

O que mudou em relação a hoje:

- O **valor sobe** pra logo depois das cores (antes vinha depois do cliente).
- O **cliente desce**: some do topo e vira um passo **revelado** só quando ela
  aperta "Vendido". Aí o `autoFocus` no campo faz sentido (não há mais seletor
  de cor logo acima pra ele rolar por cima).
- Os botões viram **"Vendido por R$X"** e **"Só orçamento"**. "Só orçamento"
  volta pra fábrica sem registrar nada — a notinha do cliente já ficou visível
  na tela pra ela mandar o orçamento.
- As **notinhas continuam ao vivo** o tempo todo (a do cliente é o orçamento
  mandável durante a conversa).
- O diálogo **"Já te pagou?"** (cofrinho+confete vs. Falta receber) **fica** —
  é ortogonal e ninguém pediu pra tirar.

## Mudanças por arquivo

### [components/PrecoVendido.tsx](../../../components/PrecoVendido.tsx)

Reformular só a copy do cabeçalho (a mecânica de ganha/perde fica intacta):

- Título: **"Por quanto você vai vender?"** (era "Faça um teste de negociação 🤝").
- Subtítulo: algo como **"Ajuste o valor — o verde te diz se vale a pena."**
- O atalho "voltar pro preço indicado" permanece.

Uso único (só a `/resultado`), então a copy pode mudar direto no componente.

### [app/resultado/page.tsx](../../../app/resultado/page.tsx)

- Novo estado `vendendo` (boolean, começa `false`): controla o passo revelado
  do cliente.
- **Bloco do topo** (modo orçamento): banner `ehNovo` reformulado + seletor de
  cor + `<PrecoVendido>`. **Remover** daqui a seção "Pra quem é?".
- **Notinhas**: sem mudança de posição — continuam ao vivo abaixo do topo.
- **Bloco de decisão** (`mt-10`), com dois estados:
  - `!vendendo`: pergunta "Fechou a venda?" + botões
    **"Vendido por {brl(precoNota)}"** (habilitado quando `podeIniciar`) e
    **"Só orçamento"** (`router.push("/fabrica")`). "Vendido" só faz
    `setVendendo(true)` — ainda não grava nada.
  - `vendendo`: seção "Pra quem é?" (input com `autoFocus` + pastilhas de
    recentes) + botão **"Confirmar venda"** (habilitado quando há nome) que abre
    o `perguntandoPagou`, e um "voltar" que faz `setVendendo(false)`.
- Regras:
  - `podeIniciar = coresIds.length > 0 && precoNota > 0`.
  - Confirmar exige `nomeLimpo(cliente).length > 0`.
  - `registrarVenda(jaPagou)` **inalterada** (já usa `cliente`, `precoNota`,
    `coresIds`).
  - Label do botão: `precoNota > 0 ? "Vendido por " + brl(precoNota) : "Vendido"`.
- Textos de ajuda:
  - Antes de "Vendido": se `coresIds.length === 0` → "Escolhe pelo menos uma
    cor."; senão se `precoNota <= 0` → "Põe o valor pra marcar como vendido."
  - No passo do cliente: se sem nome → "Escreve pra quem é pra fechar."

## Casos de borda

- **"A conta" / só ver** (sem `cores`): inalterado, só leitura, sem nada disso.
- **Só orçamento:** volta pra fábrica; nenhuma venda gravada; a notinha do
  cliente já estava visível pra mandar.
- **"Vendido" com preço 0 ou sem cor:** botão desabilitado, texto de ajuda
  explica. Ela não chega no passo do cliente sem preço/cor.
- **Voltar do passo do cliente:** `setVendendo(false)` volta pros dois botões; o
  que ela digitou de nome permanece no estado (não atrapalha).
- **Revenda (Fase 2):** esta tela também é usada pelo "Vender de novo". A ordem
  nova serve os dois; o comportamento específico de revenda entra na Fase 2.

## Testes

- Sem lógica pura nova (é reordenação de UI + um booleano de revelação).
- `lib/*.test.ts` seguem verdes (nenhuma regra de preço/venda muda).
- Verificação manual: criar peça na `/novo` → cai na nota → ajusta o valor →
  vê as notinhas → "Vendido por R$X" → aparece "Pra quem é?" → confirma →
  "já pagou?" → cai em Vendidos/Falta receber. E o caminho "Só orçamento" →
  volta pra fábrica.

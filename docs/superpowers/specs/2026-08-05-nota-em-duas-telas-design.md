# Nota em duas telas: ajustar → ver a notinha → fechar

**Data:** 2026-08-05
**Status:** Aprovado em conversa (aguardando implementação)

## Ideia

O `components/Nota.tsx` passa a ter **duas fases** (dois "ecrãs" na mesma
página), pra dar mais fluxo:

- **Fase "ajustar":** o resumo (quando houver) + o teste de negociação
  (`PrecoVendido`) + o seletor de cor/nome quando cabe. Um botão **"Ver a
  notinha"** leva pra fase seguinte.
- **Fase "fechar":** "Pra quem é?" (o nome preenche a notinha ao vivo) → as duas
  notinhas → embaixo **[Vendido por R$X] / [Só orçamento]**. Um "voltar"
  retorna pra fase "ajustar".

Vale pros dois usos do `Nota` (`/novo` passo 4 e `/resultado`), por consistência.
`somenteLeitura` ("A conta") não tem fases — mostra só as notinhas.

Isto **supera** duas decisões anteriores da mesma tela: as notinhas não ficam
mais visíveis durante a negociação (vão pra fase "fechar", atrás do botão), e o
cliente não aparece mais só depois de "Vendido" (aparece na fase "fechar", antes
do vendeu/não, pra já preencher a notinha que ela vai encaminhar).

## Fluxo

```
FASE AJUSTAR
  [resumo — só na /novo: "Quanto ficou?" custo + preço indicado]
  Faça um teste de negociação   (PrecoVendido, ganha/perde)
  [ Ver a notinha ]  → (exige cor + valor)

FASE FECHAR
  Pra quem é?   (nome + pastilhas de recentes — preenche a notinha)
  [ só sua ]  [ pro cliente ← dá pra encaminhar ]
  [ Vendido por R$X ]  [ Só orçamento ]      [ ‹ voltar ]
        └─► "Já te pagou?" → grava
```

## Mudanças

### [components/Nota.tsx](../../../components/Nota.tsx)

- Estado novo `fase: "ajustar" | "fechar"` (começa "ajustar"). **Remove** o
  estado `vendendo` (o passo do cliente vira a fase "fechar").
- Prop nova `resumo?: ReactNode` — renderizada no topo da fase "ajustar" (a
  /novo passa o "Quanto ficou?"; a /resultado não passa nada).
- Fase "ajustar": `resumo` + (repete: resumo+"Mudou algo?" | senão: nome[repete]
  + cor[permiteMudarCor] + `PrecoVendido`) + botão **"Ver a notinha"**
  (desabilitado sem cor/valor — `podeIniciar`) + texto de ajuda.
- Fase "fechar": "Pra quem é?" (input + pastilhas, foco) + as duas notinhas +
  **[Vendido por R$X]** (exige nome) / **[Só orçamento]** + **‹ voltar**
  (`setFase("ajustar")`). Mantém o diálogo "Já te pagou?".
- `somenteLeitura`: só as notinhas (sem fases), como hoje.

### [app/novo/page.tsx](../../../app/novo/page.tsx)

- Remove o bloco separado `<Passo pergunta="Quanto ficou?">` com o resumo.
- Passa esse resumo (custo pra fabricar + preço indicado) via `resumo={...}` pro
  `<Nota>`. Renderiza o `<Nota>` só quando `resultado` existe.

### [app/resultado/page.tsx](../../../app/resultado/page.tsx)

- Nenhuma mudança — a fase é interna ao `Nota`.

## Casos de borda

- **Sem cor/valor:** "Ver a notinha" desabilitado, texto explica.
- **Voltar:** da fase "fechar" volta pra "ajustar"; o que ela digitou (nome,
  valor) permanece.
- **Só orçamento:** na fase "fechar", volta pra fábrica; a notinha do cliente já
  estava ali pra encaminhar.
- **A conta** (`somenteLeitura`): sem fases.
- **Repete** (`/resultado` vender de novo): fase "ajustar" mostra o resumo +
  "Mudou algo?"; o resto segue igual.

## Testes

- Sem lógica pura nova (é reorganização de fases na UI). `lib/*.test.ts` verdes;
  typecheck + build validam a fiação.
- Manual: /novo → passo 4 mostra quanto ficou + teste + "Ver a notinha" → tela 2
  com nome + notinhas + vendeu/não; "voltar" preserva o valor. E /resultado
  (Fazer orçamento, Vender de novo, A conta) coerente.

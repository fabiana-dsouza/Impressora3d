# 🚀 Calculadora da Minha Startup

Uma calculadora de custos e preços para produtos de **impressão 3D** (feita
pensando na **Bambu Lab A1**), simples e divertida o suficiente para uma
criança de 10 anos usar sozinha.

> "Quanto eu gastei?" e "Quanto eu vou ganhar?" — sem jargão. ✨

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:3000
```

Outros comandos:

```bash
npm test         # roda os testes do módulo de cálculo (Vitest)
npm run build    # build de produção
```

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (tema escuro "gamer")
- **Supabase** — login (email + senha) e banco de dados Postgres
- Pronto pra **deploy na Vercel**

## 🔌 Ligando o banco (Supabase) — obrigatório

O app exige login e guarda tudo na nuvem. Configuração (uma vez só):

1. **Crie o projeto**: entre em [supabase.com](https://supabase.com), crie uma
   conta grátis e um projeto novo.
2. **Crie as tabelas**: no projeto, abra o **SQL Editor**, cole o conteúdo de
   [supabase/schema.sql](supabase/schema.sql) e clique em **RUN**.
3. **Copie as chaves**: em **Settings → API**, copie a *Project URL* e a chave
   *anon public*. Copie o arquivo `.env.local.example` para `.env.local` e
   preencha:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   ```

4. Reinicie o `npm run dev` e crie a primeira conta na tela de login. 🎉

**Dica pra facilitar com criança:** no Supabase, em
**Authentication → Providers → Email**, desligue *"Confirm email"* — assim a
conta entra na hora, sem precisar clicar em link de confirmação.

**Pra fechar os cadastros** (depois de criar as contas da família): em
**Authentication → Settings**, desative *"Allow new users to sign up"*.

### Por que é seguro

- **Row Level Security (RLS)** no Postgres: cada usuário só consegue ler e
  mexer nas **próprias** linhas — a regra é aplicada no banco, não na tela.
- A chave `anon` que fica no navegador é **pública por design**; sem sessão
  logada ela não enxerga dado nenhum (as policies bloqueiam).
- Segredos ficam no `.env.local`, que está no `.gitignore`.
- O middleware protege todas as rotas: sem login → vai pra `/login`.
- Os dados antigos do `localStorage` **migram sozinhos** pro banco no
  primeiro login.

## 💳 Assinaturas (Mercado Pago)

O app é pago: criar conta é grátis, mas a fábrica só abre com assinatura
ativa (R$ 120/mês ou R$ 1.200/ano — valores em [lib/planos.ts](lib/planos.ts)).
A trava é aplicada **no banco** (sem assinatura, o Postgres recusa criar
produto) e na interface (a home manda pra `/planos`).

**Como o dinheiro chega até você:** o cliente digita o cartão na página do
Mercado Pago (nunca no app), o MP cobra todo mês sozinho e deposita na sua
conta Mercado Pago — de lá você transfere pro seu banco. O app não vê nem
guarda cartão de ninguém.

### Configurar (uma vez, pessoa adulta)

1. Crie uma conta em [mercadopago.com.br](https://mercadopago.com.br)
   (aceita CPF) e vincule sua conta bancária nela.
2. Em **Suas integrações → Criar aplicação**, crie uma aplicação e copie o
   **Access Token de produção**. Coloque no `.env.local` (e na Vercel) como
   `MP_ACCESS_TOKEN`.
3. No Supabase, **Settings → API**, copie a chave **service_role** e coloque
   como `SUPABASE_SERVICE_ROLE_KEY` (ela é secreta — nunca vai pro navegador).
4. Rode o [supabase/schema.sql](supabase/schema.sql) de novo (cria a tabela
   `assinaturas` e a trava). Edite a lista de **cortesia** no final do
   arquivo com os emails da família (contas liberadas sem pagar).
5. Depois do deploy, em **Suas integrações → sua aplicação → Webhooks**,
   cadastre a URL `https://SEU-SITE.vercel.app/api/mercadopago` para o
   evento de **assinaturas (preapproval)**. É esse aviso que libera a conta
   sozinha quando o pagamento confirma.
6. Preencha `NEXT_PUBLIC_SITE_URL` com a URL pública do site.

**Importante:** o webhook só funciona com o site publicado (o Mercado Pago
não alcança `localhost`). Pra testar antes do deploy, dá pra liberar uma
conta na mão no SQL Editor:

```sql
insert into public.assinaturas (user_id, status)
select id, 'ativa' from auth.users where email = 'conta@gmail.com'
on conflict (user_id) do update set status = 'ativa';
```

**Formalização:** pra vender assinatura direitinho no Brasil, vale abrir um
MEI (gratuito, online) quando as vendas começarem.

## Deploy na Vercel

1. Suba o projeto num repositório Git.
2. Importe na [Vercel](https://vercel.com/new) — ela detecta Next.js sozinha.
3. Em **Settings → Environment Variables**, adicione todas as variáveis do
   `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` e `NEXT_PUBLIC_SITE_URL`
   (com a URL final do site).
4. No Supabase, em **Authentication → URL Configuration**, coloque a URL do
   site (ex: `https://seu-app.vercel.app`) como *Site URL*.
5. Clique em **Deploy**.

## Novidades

- 🎨 **Várias cores por produto** — cada cor tem seu peso e tudo é somado.
- ⚖️ **Peso em gramas ou kg** — botãozinho pra trocar a unidade no wizard.
- 📦 **Embalagem sempre incluída** (R$ 3,00 por padrão, editável nas Configurações).
- 💙 **Visual mais "raiz"** — tons de azul, aço e ciano (sem rosa/roxo), fonte Rubik.
- 📱💻 **Responsivo** — funciona bem no celular e cresce pra grades no computador.
- 🧾 **Final bem claro** — **VALOR DE CUSTO** e **VALOR PARA VENDER** em cima, barra 🚦 vermelho/verde embaixo.
- 🗣️ **Testador de preço** — a criança digita o preço que alguém ofereceu e vê na hora se **GANHA** 🎉 ou **PERDE** 😱 (em vez de escolher a margem num slider).

## Como funciona a conta

O módulo puro de cálculo fica em [lib/calc.ts](lib/calc.ts) e é 100% testado
em [lib/calc.test.ts](lib/calc.test.ts). As fórmulas:

```
custoMaterial = soma de (gramas × preçoPorGrama) de cada cor usada
custoEnergia  = horas × (potência/1000 × tarifaKwh)
custoDesgaste = horas × (preçoImpressora / vidaÚtilHoras)
subtotal      = material + energia + desgaste + extras
custoFalhas   = subtotal × taxaFalhas
custoTotal    = subtotal + custoFalhas
precoBase     = custoTotal × (1 + margem)      # margem TRAVADA em >= 15%
precoVenda    = precoBase / (1 - taxaMarketplace)   # taxa embutida DEPOIS da margem
precoVenda    = arredonda pra cima em múltiplos de R$ 0,50
lucro         = precoVenda − custoTotal − (precoVenda × taxaMarketplace)
```

### Travas de segurança

- A **margem nunca baixa de 15%** (`MARGEM_MINIMA`), mesmo que o slider ou as
  configs tentem — a trava é aplicada dentro do cálculo puro.
- O **preço de venda nunca fica abaixo de `custoTotal × 1,15`**.
- A taxa do marketplace é embutida **depois** da margem, pra não comer o lucro.

## Telas

| Tela | Rota | O que faz |
|------|------|-----------|
| 🏠 Home | `/` | Cards dos produtos + "Se vender tudo, você ganha R$ X!" |
| ➕ Novo Produto | `/novo` | Wizard de 4 passos: nome → cores+peso → tempo → resultado |
| 🧮 Resultado | `/resultado` | Custo/Venda grandes, barra 🚦, testador de preço + confete |
| 🎨 Minhas Cores | `/cores` | Cadastro de filamentos com bolinha de cor |
| ⚙️ Configurações | `/config` | Ajustes em linguagem simples |

## Valores padrão (editáveis nas Configurações)

- Filamento básico: **R$ 105/kg** → R$ 0,105/g
- Filamento especial: **R$ 170/kg** → R$ 0,17/g
- Energia: potência **100 W** × tarifa **R$ 0,85/kWh** ≈ R$ 0,085/h
- Desgaste: **R$ 5.500** ÷ **5.000 h** = R$ 1,10/h
- Embalagem: **R$ 3,00** (sempre incluída)
- Taxa de falhas: **10%**
- Margem padrão: **100%** (slider de 15% a 300%)

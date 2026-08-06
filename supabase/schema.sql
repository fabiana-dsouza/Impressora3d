-- =====================================================================
-- Preço de Fábrica — schema do Supabase
-- Cole este arquivo inteiro no SQL Editor do seu projeto e clique RUN.
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- =====================================================================

-- ---------- Configurações (uma linha por usuário) ----------
create table if not exists public.configs (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  potencia_watts   numeric not null default 100,
  tarifa_kwh       numeric not null default 0.85,
  preco_impressora numeric not null default 5500,
  vida_util_horas  numeric not null default 5000,
  taxa_falhas      numeric not null default 0.1,
  margem_padrao    numeric not null default 1.0,
  custo_embalagem  numeric not null default 3.0,
  atualizado_em    timestamptz not null default now()
);

-- ---------- Cores / filamentos ----------
create table if not exists public.cores (
  id            text not null,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null,
  hex           text not null,
  tipo          text not null check (tipo in ('basica', 'especial')),
  preco_rolo_kg numeric not null default 0,
  criado_em     timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- Produtos ----------
create table if not exists public.produtos (
  id        text not null,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome      text not null,
  cores_ids jsonb not null default '[]',
  gramas    numeric not null default 0,
  unidade   text not null default 'g' check (unidade in ('g', 'kg')),
  horas     integer not null default 0,
  minutos   integer not null default 0,
  margem    numeric not null default 1,
  vendidos  integer not null default 0,
  criado_em timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists produtos_usuario_data
  on public.produtos (user_id, criado_em desc);

-- Preço que foi REALMENTE vendido (0 = usa o preço sugerido).
-- Fica separado porque nem sempre o preço sugerido é o preço final.
alter table public.produtos
  add column if not exists preco_venda numeric not null default 0;

-- =====================================================================
-- SEGURANÇA: Row Level Security
-- Cada usuário só enxerga e mexe nas PRÓPRIAS linhas.
-- Mesmo com a chave pública (anon key) exposta no navegador,
-- o banco recusa qualquer acesso a dados de outra pessoa.
-- =====================================================================

alter table public.configs  enable row level security;
alter table public.cores    enable row level security;
alter table public.produtos enable row level security;

drop policy if exists "donos podem tudo" on public.configs;
create policy "donos podem tudo" on public.configs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "donos podem tudo" on public.cores;
create policy "donos podem tudo" on public.cores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "donos podem tudo" on public.produtos;
create policy "donos podem tudo" on public.produtos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- PERFIS: nome da empresa (login por email OU por nome da empresa)
-- =====================================================================

-- pgcrypto: usado pra conferir a senha dentro do banco (função crypt).
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.perfis (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nome_empresa text not null,
  email        text not null,
  criado_em    timestamptz not null default now()
);

-- ---------- Regra 1: NOME DE EMPRESA não pode repetir ----------
-- (sem diferenciar maiúscula/minúscula: "Dino" e "dino" são a mesma)
create unique index if not exists perfis_nome_empresa_unico
  on public.perfis (lower(nome_empresa));

-- ---------- Regra 2: EMAIL não pode repetir ----------
-- O Gmail ignora pontos e o "+apelido": fabi.souza@gmail.com e
-- fabisouza+loja@gmail.com são a MESMA caixa. O índice compara a forma
-- canônica, então não dá pra criar duas contas com o mesmo Gmail.
create unique index if not exists perfis_email_unico
  on public.perfis (
    lower(
      replace(split_part(split_part(email, '@', 1), '+', 1), '.', '')
      || '@' ||
      split_part(email, '@', 2)
    )
  );

alter table public.perfis enable row level security;

drop policy if exists "dono cuida do perfil" on public.perfis;
create policy "dono cuida do perfil" on public.perfis
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Regra 3: o usuário NÃO pode mexer no próprio email/id ----------
-- Só o nome da empresa é editável. O perfil nasce pelo gatilho abaixo.
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (nome_empresa) on public.perfis to authenticated;

-- Ao criar a conta, guarda o perfil automaticamente (nome vem do cadastro).
-- Também exige @gmail.com aqui no banco — assim a regra vale mesmo que
-- alguém tente cadastrar por fora do nosso site.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@gmail.com' then
    raise exception 'So aceitamos email @gmail.com';
  end if;

  insert into public.perfis (user_id, nome_empresa, email)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'nome_empresa'), ''),
        'Empresa ' || left(new.id::text, 4)
      ),
      30
    ),
    lower(new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Contas criadas antes do gatilho existir ganham perfil agora.
insert into public.perfis (user_id, nome_empresa, email)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'nome_empresa'), ''),
      split_part(u.email, '@', 1) || '-' || left(u.id::text, 4)
    ),
    30
  ),
  lower(u.email)
from auth.users u
where u.email is not null
  and not exists (select 1 from public.perfis p where p.user_id = u.id)
on conflict do nothing;

-- ---------- Login por nome da empresa (sem vazar email) ----------
-- Só devolve o email se a SENHA estiver certa. Assim ninguém consegue
-- ficar chutando nomes de empresa pra descobrir os emails das pessoas.
drop function if exists public.email_da_empresa(text);

create or replace function public.email_da_empresa(p_nome text, p_senha text)
returns text
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_email text;
  v_hash  text;
begin
  select p.email, u.encrypted_password
    into v_email, v_hash
  from public.perfis p
  join auth.users u on u.id = p.user_id
  where lower(p.nome_empresa) = lower(trim(p_nome))
  limit 1;

  if v_email is null or v_hash is null then
    return null;
  end if;

  if v_hash = crypt(p_senha, v_hash) then
    return v_email;
  end if;

  return null;
end;
$$;

-- Diz se já existe uma empresa com esse nome (pra avisar no cadastro).
-- Só revela "esse nome está em uso", nunca dados de ninguém.
create or replace function public.empresa_existe(p_nome text)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where lower(nome_empresa) = lower(trim(p_nome))
  );
$$;

-- Diz se esse Gmail já tem conta, comparando na forma CANÔNICA — sem pontos e
-- sem +apelido, exatamente como o índice perfis_email_unico compara. Serve pro
-- cadastro avisar "esse Gmail já tem conta" ANTES de tentar criar. Sem isto, o
-- Gmail "souza.dfabi" (salvo com ponto) e o "souzadfabi" passam batido pelo
-- auth (que compara texto exato), mas colidem aqui na hora de gravar o perfil —
-- e a pessoa só via o erro cru "Database error saving new user".
-- Só revela "esse email está em uso", nunca dados de ninguém.
create or replace function public.email_existe(p_email text)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where lower(
            replace(split_part(split_part(email, '@', 1), '+', 1), '.', '')
            || '@' || split_part(email, '@', 2)
          )
        = lower(
            replace(split_part(split_part(p_email, '@', 1), '+', 1), '.', '')
            || '@' || split_part(p_email, '@', 2)
          )
  );
$$;

grant execute on function public.email_da_empresa(text, text) to anon, authenticated;
grant execute on function public.empresa_existe(text)         to anon, authenticated;
grant execute on function public.email_existe(text)           to anon, authenticated;

-- =====================================================================
-- ASSINATURAS: quem pagou pode usar a fábrica
-- Quem escreve aqui é SÓ o servidor (webhook do Mercado Pago, com a
-- chave service_role). O usuário apenas enxerga a própria assinatura.
-- =====================================================================

create table if not exists public.assinaturas (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  status        text not null default 'pendente'
                check (status in ('pendente', 'ativa', 'atrasada', 'cancelada')),
  plano         text check (plano in ('mensal', 'anual')),
  provedor      text not null default 'mercadopago',
  provedor_id   text,
  -- até quando está pago; NULL = sem vencimento (cortesia ou MP controla)
  pago_ate      timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

drop policy if exists "dono ve assinatura" on public.assinaturas;
create policy "dono ve assinatura" on public.assinaturas
  for select
  using (auth.uid() = user_id);

-- usuário só LÊ; escrever é papel do servidor (service_role ignora RLS)
revoke all on public.assinaturas from anon, authenticated;
grant select on public.assinaturas to authenticated;

-- Está valendo? (usada na trava de criar produto)
-- Duas formas de estar valendo:
--   1) ATIVA: assinatura em dia. A tolerância de 3 dias no `pago_ate` é de
--      propósito — o aviso de renovação do Mercado Pago pode atrasar, e sem
--      essa folga a conta de quem PAGOU seria barrada no minuto seguinte ao
--      vencimento por causa de um webhook lento. (pago_ate null = cortesia.)
--   2) CANCELADA mas ainda no período já pago: quem cancela para as cobranças
--      futuras, mas continua usando até acabar o mês/ano que já pagou. Aqui o
--      corte é limpo (sem folga): no dia do vencimento, acaba.
create or replace function public.assinatura_ativa()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.assinaturas
    where user_id = auth.uid()
      and (
        (status = 'ativa'
          and (pago_ate is null or pago_ate > now() - interval '3 days'))
        or
        (status = 'cancelada' and pago_ate is not null and pago_ate > now())
      )
  );
$$;

grant execute on function public.assinatura_ativa() to authenticated;

-- ---------- Trava de verdade: sem assinatura, não CRIA produto ----------
-- (ver/editar/apagar o que já existe continua liberado — o dado é da pessoa)
drop policy if exists "donos podem tudo" on public.produtos;
drop policy if exists "dono ve produtos" on public.produtos;
drop policy if exists "dono edita produtos" on public.produtos;
drop policy if exists "dono apaga produtos" on public.produtos;
drop policy if exists "cria produto com assinatura" on public.produtos;

create policy "dono ve produtos" on public.produtos
  for select using (auth.uid() = user_id);
create policy "dono edita produtos" on public.produtos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga produtos" on public.produtos
  for delete using (auth.uid() = user_id);
create policy "cria produto com assinatura" on public.produtos
  for insert with check (auth.uid() = user_id and public.assinatura_ativa());

-- ---------- Cortesia da família (sem cobrança, sem vencimento) ----------
-- Edite a lista de emails e rode: essas contas ficam liberadas pra sempre.
-- É um `array[...]` (não um `in (...)`) DE PROPÓSITO: um array pode ficar
-- vazio sem quebrar o SQL. Um `in ()` sem nenhum email dá erro de sintaxe.
insert into public.assinaturas (user_id, status, plano, pago_ate)
select u.id, 'ativa', null, null
from auth.users u
where lower(u.email) = any (array[
     'souza.dfabi@gmail.com'       -- <-- adicione aqui os emails da família, entre aspas e com vírgula.
            -- ex:  'tia@gmail.com', 'vovo@gmail.com'
]::text[])
on conflict (user_id) do update set status = 'ativa', pago_ate = null;

-- =====================================================================
-- CLIENTES E VENDAS
-- Uma venda é uma linha com dono, cor, preço e custo CONGELADOS. O
-- orçamento não é guardado: ela decide na hora e só o "vendi" grava.
-- =====================================================================

-- ---------- Clientes ----------
-- O nome é editável, então a chave é um id de verdade e não o nome.
create table if not exists public.clientes (
  id        text not null,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome      text not null,
  criado_em timestamptz not null default now(),
  -- Última venda pra essa pessoa: é o que ordena as pastilhas de atalho.
  usado_em  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Dois "Maria" seriam duas pastilhas idênticas na tela.
-- ATENÇÃO: é lower() e nada além disso. `chaveDoCliente` no TypeScript
-- normaliza igualzinho; se um tirasse acento e o outro não, a busca não
-- acharia a linha e o insert seguinte quebraria aqui.
-- DETALHE: o índice NÃO colapsa espaços internos (não distingue
-- "Maria  Silva" com dois espaços de "Maria Silva" com um). Portanto
-- TODA escrita precisa armazenar `nomeLimpo(nome)` de lib/clientes.ts
-- que já faz trim e colapso de espaços: o banco só guarda lower().
create unique index if not exists clientes_nome_unico
  on public.clientes (user_id, lower(nome));

create index if not exists clientes_usuario_uso
  on public.clientes (user_id, usado_em desc);

-- ---------- Vendas ----------
create table if not exists public.vendas (
  id           text not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produto_id   text,                        -- link fraco: só pro "vender de novo"
  produto_nome text not null,               -- congelado
  cliente_id   text,                        -- NULO = "** falta o nome **"
  cores_ids    jsonb not null default '[]',
  preco        numeric not null default 0,  -- congelado
  custo        numeric not null default 0,  -- congelado
  pago_em      timestamptz,                 -- NULO = falta pagar
  criado_em    timestamptz not null default now(),
  primary key (user_id, id)
);

-- "Fiz pra mim" / "dei de graça" não são venda: ganham uma etiqueta na própria
-- linha, e as vendas antigas viram 'venda' de graça pelo default. Não entram no
-- cofrinho — os totais filtram por destino no TypeScript (lib/vendas.ts).
alter table public.vendas
  add column if not exists destino text not null default 'venda'
  check (destino in ('venda', 'mim', 'graca'));

create index if not exists vendas_usuario_data
  on public.vendas (user_id, criado_em desc);

-- Nem produto_id nem cliente_id têm foreign key, de propósito:
-- NADA fora desta tabela pode destruir histórico de dinheiro. Um FK com
-- cascata faria apagar uma peça (ou um cliente) apagar vendas junto. O nome
-- da peça já está congelado; sem cliente, a linha vira "** falta o nome **",
-- que é exatamente o estado editável.

-- ---------- Migrações já feitas ----------
-- Tabela própria, e NÃO uma coluna em `perfis`: aquela tabela tem
-- `grant update (nome_empresa)` como trava de segurança deliberada, e
-- alargar o grant pra caber um flag de conveniência enfraqueceria a trava.
--
-- CONTRATO: a linha de marcador é inserida SÓ DEPOIS que os writes da
-- migração terminaram com sucesso. Portanto nunca há necessidade de
-- apagar/atualizar: não há insert ou delete/update policy.
-- Se uma migração futura marcar-se pronta ANTES de acabar, não tem jeito
-- de desfazer sem um `delete` manual contra o banco vivo.
create table if not exists public.migracoes (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome     text not null,
  feita_em timestamptz not null default now(),
  primary key (user_id, nome)
);

alter table public.clientes  enable row level security;
alter table public.vendas    enable row level security;
alter table public.migracoes enable row level security;

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

drop policy if exists "dono ve vendas" on public.vendas;
drop policy if exists "dono edita vendas" on public.vendas;
drop policy if exists "dono apaga vendas" on public.vendas;
drop policy if exists "cria venda com assinatura" on public.vendas;

create policy "dono ve vendas" on public.vendas
  for select using (auth.uid() = user_id);
create policy "dono edita vendas" on public.vendas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga vendas" on public.vendas
  for delete using (auth.uid() = user_id);
create policy "cria venda com assinatura" on public.vendas
  for insert with check (auth.uid() = user_id and public.assinatura_ativa());

drop policy if exists "dono ve migracoes" on public.migracoes;
drop policy if exists "dono marca migracoes" on public.migracoes;

create policy "dono ve migracoes" on public.migracoes
  for select using (auth.uid() = user_id);
-- Migrações NÃO são gatilhadas por `assinatura_ativa()`: é um reparo
-- único dos dados antigos da conta. Quem cancelou a assinatura ainda
-- precisa poder completar a migração. RLS já confina a linha a
-- `auth.uid() = user_id`, então ninguém acessa dados de terceiros.
create policy "dono marca migracoes" on public.migracoes
  for insert with check (auth.uid() = user_id);

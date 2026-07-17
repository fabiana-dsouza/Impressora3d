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
insert into public.assinaturas (user_id, status, plano, pago_ate)
select u.id, 'ativa', null, null
from auth.users u
where lower(u.email) in (
            -- <-- adicione aqui os emails da família
)
on conflict (user_id) do update set status = 'ativa', pago_ate = null;

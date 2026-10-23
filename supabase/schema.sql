-- Corner: tabelas da conta no Supabase.
--
-- Como rodar: Supabase Dashboard > SQL Editor > New query > cole TODO este arquivo > Run.
-- É seguro rodar de novo: nada é apagado nem recriado se já existir.
--
-- Como o app usa o banco: só o SERVIDOR do Corner fala com o Supabase (chave secreta, nunca no navegador).
-- Por isso as tabelas ficam com RLS ligado e SEM nenhuma política: a chave pública (anon) não lê nem grava nada.
-- Quem decide de quem é cada linha é o servidor, a partir da sessão do login (coluna user_id / id).
-- O banco só guarda; quem valida o formato dos dados é o contrato do app (lib/dados/contrato.ts).

-- ── Perfil e configurações ───────────────────────────────────
create table if not exists public.profiles (
  id          text primary key,                       -- id do usuário do app (hoje: u_test)
  name        text,
  level       text,                                   -- nível: iniciante | intermediario | avancado
  days_per_week int,                                  -- meta semanal de treinos
  settings    jsonb not null default '{}'::jsonb,     -- configurações completas (fonte da verdade do app)
  updated_at  timestamptz not null default now()
);

-- ── Treinos (uma linha por treino registrado) ────────────────
create table if not exists public.workouts (
  user_id            text not null,
  id                 text not null,                   -- id gerado pelo app (nem sempre é uuid, por isso text)
  date               timestamptz not null,
  type               text not null,                   -- tec | con | spa
  rounds             numeric not null,
  round_min          numeric not null,
  rpe                numeric not null,
  duration_seconds   numeric not null,
  session_id         text,                            -- sessão do plano que originou o treino
  note               text,
  sparring_intensity text,                            -- leve | moderada | forte
  sparring_head      text,                            -- nenhum | leves | fortes
  sparring_partner   text,
  position           int not null default 0,          -- posição na lista do app (o histórico guarda o mais novo primeiro)
  created_at         timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists workouts_user_position_idx on public.workouts (user_id, position);

-- ── Plano de treino ativo (no máximo um por usuário) ─────────
create table if not exists public.active_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null unique,
  plan_id    text not null,
  started_at date not null,                           -- segunda-feira da semana 1 (data do calendário, sem fuso)
  updated_at timestamptz not null default now()
);

-- ── Demais dados (check-ins, lesões, peso, reagendamentos, estado do dia) ──
create table if not exists public.user_data (
  user_id    text not null,
  entity     text not null,                           -- checkins | lesoes | pesos | reag | checklist | ajuste
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity)
);

-- ── Segurança: RLS ligado, sem políticas, sem acesso para as chaves públicas ──
alter table public.profiles     enable row level security;
alter table public.workouts     enable row level security;
alter table public.active_plans enable row level security;
alter table public.user_data    enable row level security;

revoke all on table public.profiles, public.workouts, public.active_plans, public.user_data from anon, authenticated;

-- ── Troca a lista de treinos de um usuário de uma vez, sem deixar a lista pela metade ──
-- Insere ou atualiza os treinos recebidos e apaga os que não estão mais na lista, tudo na mesma transação.
create or replace function public.substituir_treinos(p_user text, p_linhas jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.workouts (user_id, id, date, type, rounds, round_min, rpe, duration_seconds, session_id, note, sparring_intensity, sparring_head, sparring_partner, position)
  select p_user, t.l->>'id', (t.l->>'date')::timestamptz, t.l->>'type', (t.l->>'rounds')::numeric, (t.l->>'round_min')::numeric,
         (t.l->>'rpe')::numeric, (t.l->>'duration_seconds')::numeric, t.l->>'session_id', t.l->>'note',
         t.l->>'sparring_intensity', t.l->>'sparring_head', t.l->>'sparring_partner', t.pos::int
  from jsonb_array_elements(p_linhas) with ordinality as t(l, pos)
  on conflict (user_id, id) do update set
    date = excluded.date, type = excluded.type, rounds = excluded.rounds, round_min = excluded.round_min,
    rpe = excluded.rpe, duration_seconds = excluded.duration_seconds, session_id = excluded.session_id,
    note = excluded.note, sparring_intensity = excluded.sparring_intensity,
    sparring_head = excluded.sparring_head, sparring_partner = excluded.sparring_partner,
    position = excluded.position;

  delete from public.workouts w
  where w.user_id = p_user
    and w.id <> all (array(select l->>'id' from jsonb_array_elements(p_linhas) as l));
end;
$$;

revoke all on function public.substituir_treinos(text, jsonb) from public, anon, authenticated;
grant execute on function public.substituir_treinos(text, jsonb) to service_role;

-- Para desfazer tudo (apaga os dados!):
--   drop function if exists public.substituir_treinos(text, jsonb);
--   drop table if exists public.user_data, public.active_plans, public.workouts, public.profiles;

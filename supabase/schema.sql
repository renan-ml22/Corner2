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

-- ── Cornerman, etapa 2: fichas dos alunos do treinador (também em cornerman-etapa-2.sql) ──
create table if not exists public.coach_alunos (
  id            uuid primary key default gen_random_uuid(),
  coach_id      text not null,                          -- id do treinador (usuário do app; texto, como nas outras tabelas)
  nome          text not null check (char_length(nome) between 1 and 80),
  email         text check (email is null or char_length(email) <= 120),
  telefone      text check (telefone is null or char_length(telefone) <= 30),
  nivel         text check (nivel in ('iniciante', 'intermediario', 'avancado')),
  estilo        text check (estilo is null or char_length(estilo) <= 40),
  notas         text not null default '' check (char_length(notas) <= 2000),
  foto          text not null default '' check (char_length(foto) <= 60000),  -- data:image/jpeg;base64,… ou vazio
  aluno_user_id text,                                   -- vazio até o aluno aceitar um convite (etapa 3)
  status        text not null default 'ativo' check (status in ('ativo', 'convidado', 'encerrado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists coach_alunos_coach_idx on public.coach_alunos (coach_id);

alter table public.coach_alunos enable row level security;
revoke all on table public.coach_alunos from anon, authenticated;

-- ── Limite de 20 alunos por treinador ────────────────────────
-- Conta as fichas que não estão encerradas. Vale ao criar e ao reabrir uma ficha encerrada, e o bloqueio por treinador
-- (advisory lock) faz dois pedidos ao mesmo tempo na vaga 20 não passarem juntos. O 20 é o LIMITE_DE_ALUNOS de
-- lib/cornerman/ficha.ts: mudou lá, mude aqui.
create or replace function public.coach_alunos_limite()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'encerrado' then
    perform pg_advisory_xact_lock(hashtext(new.coach_id));
    if (select count(*) from public.coach_alunos
        where coach_id = new.coach_id and id <> new.id and status <> 'encerrado') >= 20 then
      raise exception 'limite_de_alunos';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.coach_alunos_limite() from public, anon, authenticated;

drop trigger if exists coach_alunos_limite on public.coach_alunos;
create trigger coach_alunos_limite
  before insert or update on public.coach_alunos
  for each row execute function public.coach_alunos_limite();

-- ── Cornerman, etapa 3a: convites e vínculo (também em cornerman-etapa-3a.sql) ──
create table if not exists public.coach_invites (
  id          uuid primary key default gen_random_uuid(),
  coach_id    text not null,                              -- treinador que convidou
  aluno_id    uuid not null references public.coach_alunos(id) on delete cascade,  -- ficha convidada (apagar a ficha apaga o convite)
  token_hash  text not null unique,                       -- SHA-256 do token, em hex
  expires_at  timestamptz not null,                       -- 14 dias depois de gerado
  used_at     timestamptz,                                -- preenchido no aceite: uso único
  created_at  timestamptz not null default now()
);
create index if not exists coach_invites_aluno_idx on public.coach_invites (aluno_id);

alter table public.coach_invites enable row level security;
revoke all on table public.coach_invites from anon, authenticated;

-- ── Um treinador ativo por aluno ─────────────────────────────
-- Uma conta de aluno só pode estar ligada a UMA ficha que não esteja encerrada. Quem já tem treinador não aceita outro
-- convite até se desvincular. Garantido pelo banco, mesmo com dois aceites ao mesmo tempo.
create unique index if not exists coach_alunos_aluno_user_ativo_idx
  on public.coach_alunos (aluno_user_id)
  where aluno_user_id is not null and status <> 'encerrado';

-- ── Gerar o convite de uma ficha ─────────────────────────────
-- Apaga os convites anteriores não usados (o link antigo morre) e põe a ficha em "convidado". Em "convidado" a ficha
-- conta no limite de 20: o gatilho coach_alunos_limite pode levantar limite_de_alunos (ex.: reabrir uma encerrada).
create or replace function public.criar_convite(p_coach text, p_aluno uuid, p_hash text, p_expira timestamptz)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_ficha public.coach_alunos%rowtype;
begin
  select * into v_ficha from public.coach_alunos where id = p_aluno and coach_id = p_coach for update;
  if not found then
    raise exception 'nao_encontrado';
  end if;
  if v_ficha.aluno_user_id is not null then
    raise exception 'nao_convidavel';
  end if;

  delete from public.coach_invites where aluno_id = p_aluno and used_at is null;
  insert into public.coach_invites (coach_id, aluno_id, token_hash, expires_at) values (p_coach, p_aluno, p_hash, p_expira);
  update public.coach_alunos set status = 'convidado', updated_at = now() where id = p_aluno;
end;
$$;

-- ── Cancelar o convite ───────────────────────────────────────
create or replace function public.cancelar_convite(p_coach text, p_aluno uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_linhas integer;
begin
  update public.coach_alunos set status = 'ativo', updated_at = now()
    where id = p_aluno and coach_id = p_coach and status = 'convidado';
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    return false;
  end if;
  delete from public.coach_invites where aluno_id = p_aluno and used_at is null;
  return true;
end;
$$;

-- ── Aceitar o convite (atômico e de uso único) ───────────────
-- Trava a linha do convite: dois aceites ao mesmo tempo se enfileiram e o segundo encontra used_at preenchido.
-- Devolve o coach_id. Erros: convite_invalido, proprio_convite, ja_tem_treinador.
create or replace function public.aceitar_convite(p_hash text, p_user text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_convite public.coach_invites%rowtype;
  v_aluno uuid;
begin
  -- Ordem dos bloqueios: primeiro a ficha, depois o convite (a mesma de criar_convite e cancelar_convite). Sem isso, um
  -- aceite ao mesmo tempo de "gerar novo link" ou "cancelar" poderia travar um no outro (deadlock).
  select aluno_id into v_aluno from public.coach_invites where token_hash = p_hash;
  if not found then
    raise exception 'convite_invalido';
  end if;
  perform 1 from public.coach_alunos where id = v_aluno for update;
  select * into v_convite from public.coach_invites where token_hash = p_hash for update;
  if not found or v_convite.used_at is not null or v_convite.expires_at <= now() then
    raise exception 'convite_invalido';
  end if;
  if v_convite.coach_id = p_user then
    raise exception 'proprio_convite';
  end if;

  begin
    update public.coach_alunos set aluno_user_id = p_user, status = 'ativo', updated_at = now()
      where id = v_convite.aluno_id and coach_id = v_convite.coach_id and aluno_user_id is null and status = 'convidado';
    if not found then
      raise exception 'convite_invalido';
    end if;
  exception when unique_violation then
    raise exception 'ja_tem_treinador';
  end;

  update public.coach_invites set used_at = now() where id = v_convite.id;
  return v_convite.coach_id;
end;
$$;

-- ── Desvincular ──────────────────────────────────────────────
-- Pelo aluno (ou quando o treinador encerra a ficha): a ficha vira "encerrado" e perde a conta. O treinador mantém a
-- ficha e as notas, e perde todo acesso aos dados do aluno. Reabrir a ficha não restaura o vínculo.
create or replace function public.desvincular_aluno(p_user text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_linhas integer;
begin
  update public.coach_alunos set aluno_user_id = null, status = 'encerrado', updated_at = now()
    where aluno_user_id = p_user and status <> 'encerrado';
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

revoke all on function public.criar_convite(text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cancelar_convite(text, uuid) from public, anon, authenticated;
revoke all on function public.aceitar_convite(text, text) from public, anon, authenticated;
revoke all on function public.desvincular_aluno(text) from public, anon, authenticated;
grant execute on function public.criar_convite(text, uuid, text, timestamptz) to service_role;
grant execute on function public.cancelar_convite(text, uuid) to service_role;
grant execute on function public.aceitar_convite(text, text) to service_role;
grant execute on function public.desvincular_aluno(text) to service_role;

-- Para desfazer tudo (apaga os dados!):
--   drop function if exists public.substituir_treinos(text, jsonb);
--   drop trigger if exists coach_alunos_limite on public.coach_alunos;
--   drop function if exists public.coach_alunos_limite();
--   drop function if exists public.desvincular_aluno(text);
--   drop function if exists public.aceitar_convite(text, text);
--   drop function if exists public.cancelar_convite(text, uuid);
--   drop function if exists public.criar_convite(text, uuid, text, timestamptz);
--   drop index if exists public.coach_alunos_aluno_user_ativo_idx;
--   drop table if exists public.coach_invites, public.coach_alunos, public.user_data, public.active_plans, public.workouts, public.profiles;

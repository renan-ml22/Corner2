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

-- ── Cornerman, etapa 3b: status de treino dos alunos com conta (também em cornerman-etapa-3b.sql) ──
create or replace function public.ultimo_treino_por_aluno(p_coach text)
returns table (ficha_id uuid, ultimo timestamptz)
language sql
stable
set search_path = public
as $$
  select a.id, max(w.date)
    from public.coach_alunos a
    join public.workouts w on w.user_id = a.aluno_user_id
   where a.coach_id = p_coach
     and a.status = 'ativo'
     and a.aluno_user_id is not null
   group by a.id;
$$;

revoke all on function public.ultimo_treino_por_aluno(text) from public, anon, authenticated;
grant execute on function public.ultimo_treino_por_aluno(text) to service_role;

-- ── Cornerman, etapa 4: sugestões de plano do treinador ao aluno (também em cornerman-etapa-4.sql) ──
-- ── Sugestões ────────────────────────────────────────────────
-- status: pendente (espera o aluno), aceita, recusada, substituida (o treinador mandou outra), cancelada (o vínculo terminou
-- antes da resposta) e registrada (ficha sem conta: só um registro no histórico da ficha).
create table if not exists public.coach_suggestions (
  id           uuid primary key default gen_random_uuid(),
  coach_id     text not null,
  aluno_id     uuid not null references public.coach_alunos(id) on delete cascade,  -- apagar a ficha apaga o histórico
  aluno_user_id     text,                                  -- a conta vinculada quando foi enviada (vazio em "registrada")
  vinculo_encerrado boolean not null default false,        -- o vínculo daquela conta acabou depois: a aceita deixa de aparecer ao aluno
  plano_id     text not null check (char_length(plano_id) between 1 and 60),
  mensagem     text not null default '' check (char_length(mensagem) <= 500),
  status       text not null default 'pendente'
               check (status in ('pendente', 'aceita', 'recusada', 'substituida', 'cancelada', 'registrada')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);
create index if not exists coach_suggestions_aluno_idx on public.coach_suggestions (aluno_id, created_at desc);

-- No máximo UMA pendente por aluno, garantido pelo banco mesmo com dois pedidos ao mesmo tempo.
create unique index if not exists coach_suggestions_pendente_idx
  on public.coach_suggestions (aluno_id)
  where status = 'pendente';

alter table public.coach_suggestions enable row level security;
revoke all on table public.coach_suggestions from anon, authenticated;

-- ── Sugerir um plano ─────────────────────────────────────────
-- Ficha com conta vinculada e ativa: troca a pendente por "substituida" e grava a nova como "pendente". Qualquer outra ficha
-- (manual ou convidada): só grava "registrada". Ficha de outro treinador ou que não existe: nao_encontrado. Encerrada:
-- ficha_encerrada. O "for update" na ficha põe dois pedidos ao mesmo tempo em fila.
create or replace function public.sugerir_plano(p_coach text, p_aluno uuid, p_plano text, p_mensagem text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_ficha  public.coach_alunos%rowtype;
  v_status text;
begin
  select * into v_ficha from public.coach_alunos where id = p_aluno and coach_id = p_coach for update;
  if not found then
    raise exception 'nao_encontrado';
  end if;
  if v_ficha.status = 'encerrado' then
    raise exception 'ficha_encerrada';
  end if;

  if v_ficha.aluno_user_id is not null and v_ficha.status = 'ativo' then
    update public.coach_suggestions set status = 'substituida', answered_at = now()
      where aluno_id = p_aluno and status = 'pendente';
    v_status := 'pendente';
  else
    v_status := 'registrada';
  end if;

  insert into public.coach_suggestions (coach_id, aluno_id, aluno_user_id, plano_id, mensagem, status)
    values (p_coach, p_aluno, case when v_status = 'pendente' then v_ficha.aluno_user_id end, p_plano, p_mensagem, v_status);
  return v_status;
end;
$$;

revoke all on function public.sugerir_plano(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sugerir_plano(text, uuid, text, text) to service_role;

-- ── O que o aluno vê ─────────────────────────────────────────
-- As sugestões pendente e aceita do vínculo ATIVO desta conta (as mais novas primeiro). Só as enviadas a ESTA conta e de um
-- vínculo que não acabou: depois de desvincular, nada do vínculo antigo aparece, nem para a mesma conta que volta nem para
-- outra conta que aceite um convite novo da mesma ficha.
create or replace function public.sugestoes_do_aluno(p_user text)
returns table (id uuid, plano_id text, mensagem text, status text, created_at timestamptz, answered_at timestamptz, coach_id text)
language sql
stable
set search_path = public
as $$
  select s.id, s.plano_id, s.mensagem, s.status, s.created_at, s.answered_at, s.coach_id
    from public.coach_suggestions s
    join public.coach_alunos a on a.id = s.aluno_id
   where a.aluno_user_id = p_user
     and a.status = 'ativo'
     and s.aluno_user_id = p_user
     and not s.vinculo_encerrado
     and s.status in ('pendente', 'aceita')
   order by s.created_at desc
   limit 20;
$$;

revoke all on function public.sugestoes_do_aluno(text) from public, anon, authenticated;
grant execute on function public.sugestoes_do_aluno(text) to service_role;

-- ── Aceitar ou recusar (atômico) ─────────────────────────────
-- true só se a sugestão estava pendente e é do vínculo ativo desta conta. Duas respostas ao mesmo tempo: só uma vence.
create or replace function public.responder_sugestao(p_user text, p_id uuid, p_aceitar boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_linhas integer;
begin
  update public.coach_suggestions s
     set status = case when p_aceitar then 'aceita' else 'recusada' end, answered_at = now()
    from public.coach_alunos a
   where s.id = p_id
     and s.status = 'pendente'
     and s.aluno_user_id = p_user
     and not s.vinculo_encerrado
     and a.id = s.aluno_id
     and a.aluno_user_id = p_user
     and a.status = 'ativo';
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function public.responder_sugestao(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.responder_sugestao(text, uuid, boolean) to service_role;

-- ── Vínculo que acaba cancela a pendente ─────────────────────
-- Quando a ficha perde a conta (o aluno se desvincula ou o treinador encerra a ficha), a sugestão pendente vira "cancelada"
-- e a aceita fica marcada como de um vínculo que acabou. Nada disso reaparece se a mesma ficha for vinculada de novo mais
-- tarde, seja pela mesma conta ou por outra (a mensagem pessoal escrita para um aluno nunca chega a outra pessoa). O
-- treinador continua vendo tudo no histórico da ficha.
create or replace function public.cancelar_sugestoes_ao_desvincular()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.coach_suggestions
     set status = case when status = 'pendente' then 'cancelada' else status end,
         answered_at = case when status = 'pendente' then now() else answered_at end,
         vinculo_encerrado = true
   where aluno_id = new.id and status in ('pendente', 'aceita') and not vinculo_encerrado;
  return new;
end;
$$;

revoke all on function public.cancelar_sugestoes_ao_desvincular() from public, anon, authenticated;

drop trigger if exists coach_alunos_cancela_sugestoes on public.coach_alunos;
create trigger coach_alunos_cancela_sugestoes
  after update of aluno_user_id on public.coach_alunos
  for each row
  when (old.aluno_user_id is not null and new.aluno_user_id is null)
  execute function public.cancelar_sugestoes_ao_desvincular();

-- Para desfazer tudo (apaga os dados!):
--   drop trigger if exists coach_alunos_cancela_sugestoes on public.coach_alunos;
--   drop function if exists public.cancelar_sugestoes_ao_desvincular();
--   drop function if exists public.responder_sugestao(text, uuid, boolean);
--   drop function if exists public.sugestoes_do_aluno(text);
--   drop function if exists public.sugerir_plano(text, uuid, text, text);
--   drop function if exists public.ultimo_treino_por_aluno(text);
--   drop function if exists public.substituir_treinos(text, jsonb);
--   drop trigger if exists coach_alunos_limite on public.coach_alunos;
--   drop function if exists public.coach_alunos_limite();
--   drop function if exists public.desvincular_aluno(text);
--   drop function if exists public.aceitar_convite(text, text);
--   drop function if exists public.cancelar_convite(text, uuid);
--   drop function if exists public.criar_convite(text, uuid, text, timestamptz);
--   drop index if exists public.coach_alunos_aluno_user_ativo_idx;
--   drop table if exists public.coach_suggestions, public.coach_invites, public.coach_alunos, public.user_data, public.active_plans, public.workouts, public.profiles;

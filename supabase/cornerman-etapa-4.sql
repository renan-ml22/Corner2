-- Corner, plano Cornerman, etapa 4: sugestões de plano do treinador ao aluno.
--
-- Como rodar: Supabase Dashboard > SQL Editor > New query > cole TODO este arquivo > Run.
-- Rode DEPOIS dos cornerman-etapa-2.sql e cornerman-etapa-3a.sql (precisa de coach_alunos.aluno_user_id). É seguro rodar de novo.
--
-- Mesmo padrão das outras tabelas: só o SERVIDOR do Corner fala com o banco, com a chave secreta. RLS ligado e SEM
-- política: a chave pública (anon) não lê nem grava nada. As funções abaixo só executam com a chave de serviço.

-- ── Sugestões ────────────────────────────────────────────────
-- status: pendente (espera o aluno), aceita, recusada, substituida (o treinador mandou outra), cancelada (o vínculo terminou
-- antes da resposta) e registrada (ficha sem conta: só um registro no histórico da ficha).
create table if not exists public.coach_suggestions (
  id           uuid primary key default gen_random_uuid(),
  coach_id     text not null,
  aluno_id     uuid not null references public.coach_alunos(id) on delete cascade,  -- apagar a ficha apaga o histórico
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

  insert into public.coach_suggestions (coach_id, aluno_id, plano_id, mensagem, status)
    values (p_coach, p_aluno, p_plano, p_mensagem, v_status);
  return v_status;
end;
$$;

revoke all on function public.sugerir_plano(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sugerir_plano(text, uuid, text, text) to service_role;

-- ── O que o aluno vê ─────────────────────────────────────────
-- As sugestões pendente e aceita do vínculo ATIVO desta conta (as mais novas primeiro). Depois de desvincular, a ficha
-- perde a conta e some daqui.
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
-- Quando a ficha perde a conta (o aluno se desvincula ou o treinador encerra a ficha), a sugestão pendente vira "cancelada":
-- ela não reaparece se a mesma ficha for vinculada de novo mais tarde.
create or replace function public.cancelar_sugestoes_ao_desvincular()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.coach_suggestions set status = 'cancelada', answered_at = now()
    where aluno_id = new.id and status = 'pendente';
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

-- Para desfazer:
--   drop trigger if exists coach_alunos_cancela_sugestoes on public.coach_alunos;
--   drop function if exists public.cancelar_sugestoes_ao_desvincular();
--   drop function if exists public.responder_sugestao(text, uuid, boolean);
--   drop function if exists public.sugestoes_do_aluno(text);
--   drop function if exists public.sugerir_plano(text, uuid, text, text);
--   drop table if exists public.coach_suggestions;

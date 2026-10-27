-- Corner, plano Cornerman, etapa 3a: convites e vínculo entre treinador e aluno.
--
-- Como rodar: Supabase Dashboard > SQL Editor > New query > cole TODO este arquivo > Run.
-- Rode DEPOIS do cornerman-etapa-2.sql (precisa da tabela coach_alunos). É seguro rodar de novo.
--
-- Mesmo padrão das outras tabelas: só o SERVIDOR do Corner fala com o banco, com a chave secreta. RLS ligado e SEM
-- política: a chave pública (anon) não lê nem grava nada. As funções abaixo só executam com a chave de serviço.
--
-- O token do convite (32 bytes aleatórios) NUNCA é guardado: só o hash SHA-256 dele (token_hash).

-- ── Convites ─────────────────────────────────────────────────
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
begin
  select * into v_convite from public.coach_invites where token_hash = p_hash for update;
  if not found or v_convite.used_at is not null or v_convite.expires_at <= now() then
    raise exception 'convite_invalido';
  end if;
  if v_convite.coach_id = p_user then
    raise exception 'proprio_convite';
  end if;

  begin
    update public.coach_alunos set aluno_user_id = p_user, status = 'ativo', updated_at = now()
      where id = v_convite.aluno_id and coach_id = v_convite.coach_id and aluno_user_id is null;
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

-- Para desfazer (apaga os convites!):
--   drop function if exists public.desvincular_aluno(text);
--   drop function if exists public.aceitar_convite(text, text);
--   drop function if exists public.cancelar_convite(text, uuid);
--   drop function if exists public.criar_convite(text, uuid, text, timestamptz);
--   drop index if exists public.coach_alunos_aluno_user_ativo_idx;
--   drop table if exists public.coach_invites;

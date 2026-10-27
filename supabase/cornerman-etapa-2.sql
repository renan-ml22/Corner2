-- Corner, plano Cornerman, etapa 2: fichas dos alunos do treinador.
--
-- Como rodar: Supabase Dashboard > SQL Editor > New query > cole TODO este arquivo > Run.
-- É seguro rodar de novo: nada é apagado nem recriado se já existir (o gatilho é recriado, sem perder dados).
--
-- Mesmo padrão das outras tabelas (veja schema.sql): só o SERVIDOR do Corner fala com o banco, com a chave secreta.
-- RLS ligado e SEM nenhuma política: a chave pública (anon) não lê nem grava nada. Quem decide de quem é cada ficha é
-- o servidor, a partir da sessão do login (coluna coach_id).
--
-- Dados pessoais de terceiros (nome, e-mail, telefone e notas dos alunos): o treinador responde por eles.

-- ── Fichas de aluno ──────────────────────────────────────────
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

-- Para desfazer (apaga as fichas!):
--   drop trigger if exists coach_alunos_limite on public.coach_alunos;
--   drop function if exists public.coach_alunos_limite();
--   drop table if exists public.coach_alunos;

-- Corner, plano Cornerman, etapa 3b: status de treino dos alunos com conta.
--
-- Como rodar: Supabase Dashboard > SQL Editor > New query > cole TODO este arquivo > Run.
-- Rode DEPOIS do cornerman-etapa-3a.sql (precisa de coach_alunos.aluno_user_id). É seguro rodar de novo.
--
-- Uma função só, que o servidor chama com a chave de serviço: para cada ficha ATIVA com conta do treinador, o instante do
-- último treino do aluno. Quem nunca treinou fica de fora (o app mostra "sem treinos registrados"). O treinador só
-- recebe a data, nunca o treino.

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

-- Para desfazer:
--   drop function if exists public.ultimo_treino_por_aluno(text);

# Cornerman, etapa 4: sugestões de plano e aba "Alunos" — plano

> Para quem executa: use superpowers:executing-plans. Testes primeiro (ver falhar pelo motivo certo), um commit por tarefa.

**Objetivo:** o treinador sugere um plano de treino a um aluno; o aluno vê um aviso na tela Hoje e aceita ou recusa; o plano aceito mostra "Sugerido pelo seu treinador [Nome]"; quem tem Cornerman ou Profissional ganha a aba "Alunos" na barra, com selo vermelho.

**Desenho:** `docs/superpowers/specs/2026-10-26-cornerman-design.md`, decisões 8, 11 e 20.

## Decisões desta etapa (minhas; corrija o que não servir)

1. **Tabela `coach_suggestions`** (`id`, `coach_id`, `aluno_id` → `coach_alunos` com `on delete cascade`, `plano_id`, `mensagem` ≤ 500, `status`, `created_at`, `answered_at`). Status: `pendente`, `aceita`, `recusada`, `substituida`, `cancelada`, `registrada`. Mesmo padrão das outras: RLS ligado sem política, `revoke` de anon/authenticated, funções só para `service_role`.
2. **Uma pendente por aluno** garantida pelo banco (índice único parcial). `sugerir_plano` troca a pendente antiga por `substituida` e grava a nova, numa transação só.
3. **Ficha sem conta (manual ou convidada):** a sugestão vira só um registro (`registrada`) no histórico da ficha; o aluno não recebe nada. Ficha `encerrada`: o histórico aparece, mas não se sugere (409 `ficha_encerrada`).
4. **Vínculo que acaba cancela a pendente:** um gatilho em `coach_alunos` (quando `aluno_user_id` deixa de ser nulo para nulo) põe as pendentes em `cancelada`. Cobre o aluno que se desvincula e o treinador que encerra a ficha, e impede que uma sugestão velha reapareça num novo vínculo.
5. **Quais planos o treinador pode sugerir:** os que têm dono no catálogo (`RECURSO_DO_PLANO_DE_TREINO`: os 4 planos e os 10 treinos de atletas). Id fora dessa lista: 400.
6. **Aceitar:** o aluno responde pelo servidor (`responder_sugestao`, atômico, só se a sugestão está pendente e o vínculo é dele e ativo). Depois de o servidor confirmar, o aparelho aplica o plano (`escolherPlano`), pedindo confirmação se já houver outro. Plano que o nível do aluno não libera: sem botão de aceitar, mostra o convite ao plano, a sugestão continua pendente e ele ainda pode recusar. A trava dos planos continua só na tela, como hoje.
7. **Selo "Sugerido pelo seu treinador":** o plano ativo é o da última sugestão aceita do vínculo atual e foi escolhido na semana da aceitação ou depois. Vem do servidor (a entidade `plano` não ganha campo, para não mexer na sincronização). Limite conhecido: quem escolher o mesmo plano de novo depois continua vendo o selo.
8. **Aba "Alunos":** `ph-users-three`, só com o recurso `gestaoDeAlunos` liberado. Selo = alunos com conta e 7+ dias sem treinar, vindo de `GET /api/cornerman/alunos/selo` (usa a mesma função SQL da lista, sem fotos). Falha na consulta: sem selo, nunca um erro na tela. A aba fica entre Progresso e Perfil; o link do Perfil para `/alunos` continua.
9. **Barra com 7 colunas** validada em 360 px; se o rótulo não couber, encurta a fonte (não esconde o texto).

## Arquivos

- Novos: `supabase/cornerman-etapa-4.sql`; `lib/cornerman/sugestao.ts` (regras puras e tipos), `sugestao-banco.ts`, `sugestao-servico.ts`; rotas `app/api/cornerman/alunos/[id]/sugestoes/route.ts`, `app/api/cornerman/alunos/selo/route.ts`, `app/api/sugestao-do-treinador/route.ts`, `…/[id]/aceitar/route.ts`, `…/[id]/recusar/route.ts`; `hooks/useSugestaoDoTreinador.ts`, `hooks/useSeloDeAlunos.ts`; `components/SugestaoDoTreinador.tsx` (+css), `components/SeloDoTreinador.tsx` (+css); `app/(app)/alunos/[id]/SugerirPlano.tsx` (+css).
- Alterados: `lib/cornerman/servico.ts` (`contarAlunosVermelhos`), `cliente.ts`, `lib/navegacao.ts`, `components/BottomNav.tsx` (+css), `app/(app)/hoje/page.tsx`, `app/(app)/plano/page.tsx`, `FichaCliente.tsx`, `lib/textos.ts`, `supabase/schema.sql`, `scripts/supabase-fumaca.ts`, e2e (`alunos-simulados.ts`, `alunos.spec.ts`, `api-cornerman.spec.ts`, novo `sugestoes.spec.ts`), `docs/plano-cornerman.md`, `docs/testes.md`.

## Tarefas (cada uma: testes primeiro → código → suíte → commit)

1. **Regras puras** `sugestao.ts`: `validarNovaSugestao`, lista de planos sugeríveis, rótulos de status. Testes: plano fora do catálogo, mensagem longa/não texto, espaços aparados, corpo que não é objeto.
2. **Serviço e banco falso** `sugestao-servico.ts`: sugerir (ficha de outro/malformada = 404; encerrada = 409; sem conta = registrada), histórico campo a campo (sem `coach_id`), visão do aluno (primeiro nome, só pendente e última aceita), responder (já respondida/de outro = 404), `contarAlunosVermelhos` (7+ dias, só com conta, falha do banco sobe). Testes com banco falso que respeita o isolamento por treinador e por aluno.
3. **SQL** `cornerman-etapa-4.sql` + `schema.sql` + bloco da fumaça (prova no Postgres real: uma pendente, substituição, gatilho do vínculo, isolamento, responder só do dono).
4. **Rotas** (treinador: 401/403/404/400/409/502; aluno: 401/404) + `cliente.ts`.
5. **Tela do treinador:** aba "Plano sugerido" na ficha (escolher plano, mensagem, enviar, pendente e histórico).
6. **Tela do aluno:** aviso na Hoje (ver plano, aceitar, recusar, convite ao plano) e selo no Hoje e no Plano.
7. **Barra:** aba "Alunos" com selo; `abaAtiva`; 360 px.
8. **e2e + axe + docs + revisão independente (subagente) + passo do Renan (colar o SQL).**

# Cornerman etapa 3b — dados do aluno no painel do treinador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** o treinador ver, dos alunos vinculados, o status de treino (verde/amarelo/vermelho/cinza), o estilo e o atleta compatível (quiz guardado), o plano e os treinos dos últimos 30 dias, sem nunca receber dado de saúde.

**Architecture:** o quiz vira uma entidade sincronizada (`quiz`, texto `01203` ou vazio) gravada em `user_data`. Uma rota nova, `GET /api/cornerman/alunos/[id]/dados`, confere sessão, plano e vínculo no servidor e monta a resposta campo a campo a partir de um banco estreito (`DadosDoAlunoBancoLike`) que só seleciona colunas permitidas. O status vem de uma função SQL (`ultimo_treino_por_aluno`) e de uma função pura (`statusDeTreino`, dias de calendário em America/Sao_Paulo).

**Tech Stack:** Next 16 App Router, TypeScript estrito, CSS Modules, Vitest, Playwright, Supabase (só servidor).

**Spec:** `docs/superpowers/specs/2026-10-26-cornerman-design.md` (decisões 4, 5, 12, 19).

## Global Constraints

- Nunca sai para o treinador: lesões, peso, check-ins, `sparring_head`, notas e parceiro de sparring dos treinos, `session_id`, respostas cruas do quiz.
- Do histórico, só os **últimos 30 dias**: data, tipo, rounds, minutos por round, esforço (RPE) e duração.
- Status por dias desde o último treino, calendário de São Paulo: 0–2 verde, 3–6 amarelo, 7+ vermelho, sem treino ou ficha manual/convidada/encerrada = cinza.
- Dados do aluno só com ficha `ativo` **e** `aluno_user_id` preenchido; ficha de outro treinador, inexistente ou malformada = 404 "Aluno não encontrado."; ficha sem vínculo = 409 `sem_vinculo`.
- Id do aluno vem do banco (ficha do treinador da sessão), nunca do pedido. Erros e logs sem e-mail, telefone, notas ou dados do aluno.
- Antes do SQL 3b estar no banco a lista de alunos continua funcionando (status cinza); a aba Treinos falha com mensagem, não derruba a ficha.
- Textos em português, sem biblioteca nova; ícones só os do Phosphor 2.1.1 (`tests/icones.test.ts`).

## Review Focus

- Aluno com treinos de sparring cuja nota/parceiro/cabeça estão preenchidos: nada disso aparece na resposta (teste com `JSON.stringify`).
- Treino exatamente no limite de 30 dias e treino com data no futuro (relógio errado): futuro conta como hoje (verde), limite entra.
- Ficha `encerrado` com `aluno_user_id` herdado de dados antigos: 409, nunca dados.
- Quiz guardado corrompido no banco: vira "sem quiz", não quebra a rota.
- Dois treinos no mesmo dia e semana sem treino: gráfico mostra barra zero, sem NaN.

## File Structure

- `lib/quiz.ts` (+`isRespostasGuardadas`), `lib/dados/{contrato,entidades}.ts`, `lib/dados/servidor/servico.ts`: entidade `quiz`.
- `hooks/useQuiz.ts`, `app/(app)/quiz/QuizCliente.tsx`: gravar ao terminar.
- `lib/cornerman/status-treino.ts`: `statusDeTreino`, `textoDoStatus` (puro).
- `lib/cornerman/aluno-dados.ts`: tipos, `dadosDoAluno` (regras, puro sobre bancos).
- `lib/cornerman/aluno-dados-banco.ts`: `DadosDoAlunoBancoLike` + Supabase.
- `lib/cornerman/banco.ts`, `servico.ts`: `ultimosTreinos`, `listarAlunos` com `treino`.
- `lib/cornerman/treinos-do-aluno.ts`: `resumoDosTreinos`, `treinosPorSemana` (puro, usado pela tela).
- `app/api/cornerman/alunos/[id]/dados/route.ts`; `lib/cornerman/cliente.ts`.
- `supabase/cornerman-etapa-3b.sql` (+`schema.sql`), `scripts/supabase-fumaca.ts`.
- UI: `app/(app)/alunos/AlunosCliente.tsx` (status), `[id]/FichaCliente.tsx` + `TreinosDoAluno.tsx` + `treinos.module.css`.
- e2e: `e2e/alunos-simulados.ts`, `e2e/alunos.spec.ts`, `e2e/api-cornerman.spec.ts`, `e2e/exercicios-quiz.spec.ts`.
- Docs: `docs/plano-cornerman.md`, `docs/testes.md`.

### Task 1: Guarda do quiz (entidade `quiz`)

**Interfaces:** Produces `isRespostasGuardadas(v: unknown): v is string` (`''` ou exatamente uma resposta válida por pergunta), `DadosDoApp.quiz: string`, `useQuiz(): [string, (nova: string) => void]`.

- [ ] Testes primeiro: `tests/contrato.test.ts` (`isRespostasGuardadas`: aceita `''` e `'01203'`-válido do `data/quiz`; recusa curto, longo, dígito fora do intervalo, não-texto, `'0120a'`); `tests/supabase-servico.test.ts` (lista sincronizada inclui `quiz`; grava/volta; recusa `quiz: 'abc'`; quiz corrompido no banco não aparece); `tests/backup.test.ts` (quiz fora do backup); `tests/fusao.test.ts` (quiz: vale o da conta). Ver falhar.
- [ ] Implementar entidade em `contrato.ts`/`entidades.ts` (inicial `''`, sincronizada, fora do backup), `GENERICAS`, `hooks/useQuiz.ts`.
- [ ] Teste e2e em `e2e/exercicios-quiz.spec.ts`: terminar o quiz grava as 5 respostas no aparelho; abrir `/quiz?r=…` de outra pessoa NÃO grava. Implementar em `QuizCliente.tsx` (grava dentro de `escolher` na última pergunta, antes do `router.push`).
- [ ] `npx vitest run` verde; commit.

### Task 2: Status de treino

**Interfaces:** Produces `type CorDeStatus = 'verde' | 'amarelo' | 'vermelho' | 'cinza'`, `interface StatusDeTreino { cor: CorDeStatus; dias: number | null }`, `statusDeTreino(ultimoTreino: string | null, agora: Date): StatusDeTreino`, `textoDoStatus(s: StatusDeTreino): string` ("Treinou hoje", "Treinou ontem", "Treinou há N dias", "Sem treinos registrados").

- [ ] Testes primeiro (`tests/cornerman-status-treino.test.ts`): limites 0,2→verde; 3,6→amarelo; 7,30→vermelho; `null`→cinza; data inválida→cinza; futuro→`dias 0` verde; virada de dia em São Paulo (treino às 02:30Z de 10/10 e `agora` 12/10 às 02:00Z = 9/10 e 11/10 em SP → 2 dias → verde; `agora` 13/10 02:00Z → 3 → amarelo); textos.
- [ ] Implementar com `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })` para a chave do dia e diferença em dias de calendário. Commit.

### Task 3: Banco, serviço e rota dos dados do aluno

**Interfaces:** Produces:
- `DadosDoAlunoBancoLike { treinosRecentes(alunoId: string, desdeIso: string): Promise<unknown[]>; plano(alunoId): Promise<unknown | null>; nivel(alunoId): Promise<string | null>; dados(alunoId): Promise<{ entity: string; value: unknown }[]> }` (o serviço valida tudo que vem daqui).
- `dadosDoAluno(fichas: AlunosBancoLike, dados: DadosDoAlunoBancoLike, coachId: string, id: string, agora: Date): Promise<DadosDoAluno>`.
- `DadosDoAluno { nivel: Nivel | null; foto: string; estilo: { atletaId: string; nome: string; estilo: string; percentual: number } | null; plano: { nome: string; semana: number; semanas: number } | null; treinos: TreinoDoAluno[]; desde: string }`; `TreinoDoAluno { data: string; tipo: RegType; rounds: number; minPorRound: number; rpe: number; duracaoSegundos: number }`.
- `AlunosBancoLike.ultimosTreinos(coachId): Promise<Record<string, string>>` (id da ficha → instante do último treino); `listarAlunos` devolve `alunos: AlunoNaLista[]` (`FichaDeAluno & { treino: StatusDeTreino }`); falha ao ler os últimos treinos → todos cinza, um `console.error` sem dados.
- Rota `GET /api/cornerman/alunos/[id]/dados` → `{ dados: DadosDoAluno }`; erros: 404 igual aos demais, 409 `sem_vinculo`.

- [ ] Testes primeiro (`tests/cornerman-aluno-dados.test.ts`, `tests/cornerman-servico.test.ts` ampliado, `tests/cornerman-banco.test.ts` ampliado): todos os itens do Review Focus; resposta nunca contém `note`, `sparring`, `parceiro`, `cabeca`, `session_id`, `id` do treino, `peso`, `lesao`; só chama o banco do aluno com o `aluno_user_id` da ficha do treinador; ficha de outro treinador/malformada/inexistente = 404 sem consultar o banco do aluno; só os campos permitidos nas colunas do `select` (teste do adaptador Supabase com cliente falso: colunas exatas, `.eq('user_id')`, `.in('entity', ['quiz','foto'])`); lista: treino do RPC vira cor certa, ficha sem conta = cinza, RPC com erro = cinza + lista ok.
- [ ] Implementar `status-treino` na lista, `aluno-dados.ts`, `aluno-dados-banco.ts` (colunas `date,type,rounds,round_min,rpe,duration_seconds`; `active_plans`; `profiles.level`; `user_data` com `entity in ('quiz','foto')`), rota. `respostaDeErroDoCornerman` ganha o código `sem_vinculo` via `CodigoCornerman`.
- [ ] `e2e/api-cornerman.spec.ts`: sem sessão 401, sem plano 403, id malformado 404 (a rota é a mesma checagem das demais). Commit.

### Task 4: SQL, esquema e fumaça

- [ ] `supabase/cornerman-etapa-3b.sql` idempotente: `ultimo_treino_por_aluno(p_coach text) returns table (ficha_id uuid, ultimo timestamptz)` juntando `coach_alunos` (do treinador, `status = 'ativo'`, `aluno_user_id is not null`) a `workouts` por `user_id = aluno_user_id`, `max(date)`; `revoke ... from public, anon, authenticated`, `grant execute ... to service_role`; comentário de desfazer. Mesmo texto em `supabase/schema.sql`.
- [ ] `scripts/supabase-fumaca.ts`: bloco do último treino (PULOU se a função não existe): treinador A com aluno vinculado e dois treinos → devolve o mais novo; treinador B não vê a ficha de A; ficha encerrada some. Verificar com `npm run supabase:fumaca` (blocos PULARAM no Supabase real até o SQL ser colado) e com `npx tsc --noEmit`. Commit.

### Task 5: Telas — status na lista e aba Treinos

**Interfaces:** Consumes `dadosDoAlunoNoServidor(id): Promise<RespostaDaApi<DadosDoAluno>>` (novo em `cliente.ts`, valida o formato); Produces `resumoDosTreinos(t: TreinoDoAluno[], filtro: RegType | 'todos')`, `treinosPorSemana(t, hoje: Date, filtro)`.

- [ ] Carregar a skill `dataviz` antes de escrever o gráfico.
- [ ] Testes primeiro: `tests/cornerman-treinos-do-aluno.test.ts` (resumo: total, minutos, esforço médio com 1 casa, vazio sem NaN; semanas segunda-a-domingo, 5 barras, semana sem treino = 0; filtro por tipo); `tests/cornerman-cliente.test.ts` (dados válidos, formato errado = erro genérico, 409/404).
- [ ] e2e (`e2e/alunos-simulados.ts` ganha `/dados` e `treino` na lista; `e2e/alunos.spec.ts`): lista mostra o texto do status (não só cor) para verde/amarelo/vermelho/cinza; ficha com conta tem aba "Treinos" (ficha manual não tem); a aba mostra resumo, gráfico com texto alternativo (tabela escondida ou `aria-label` por barra), filtro por tipo muda números e lista; atleta compatível e plano; erro da rota mostra mensagem com "Tentar de novo"; axe sem violações; 360 px sem rolagem horizontal.
- [ ] Implementar `AlunosCliente.tsx` (ponto colorido + texto), `FichaCliente.tsx` (aba condicional, setas do teclado), `TreinosDoAluno.tsx`, CSS Module (cores de status em oklch, nunca só cor). Commit.

### Task 6: Documentação e fechamento

- [ ] `docs/plano-cornerman.md` (o que o treinador vê e não vê, status, SQL 3b), `docs/testes.md`; memória do projeto. Suite completa (`npx vitest run`, `npx tsc --noEmit`, lint, build, Playwright `--workers=2`), CI na branch, revisão final por subagente da branch inteira (diff da 3b). Commit.

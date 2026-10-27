# Cornerman, etapa 2: fichas e painel "Meus Alunos". Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O treinador (plano Cornerman ou Profissional) cadastra até 20 alunos como fichas, vê a lista com o contador "N de 20", abre cada ficha para ver e editar os dados e as notas, encerra, reabre ou apaga. Quem não tem o plano vê a tela de upgrade, e o servidor recusa tudo.

**Architecture:** Tabela `coach_alunos` fechada (só o servidor, com a chave secreta, fala com ela), acessada por um `AlunosBancoLike` (como `BancoLike` em `lib/dados/servidor`), regras em `lib/cornerman/servico.ts` testáveis com banco de mentira, rotas `/api/cornerman/alunos` finas. A trava de plano passa a existir **no servidor** (estado da assinatura pelo cookie assinado de 5 min ou pelo Stripe). O limite de 20 é garantido por um gatilho no banco (vale para criar e para reabrir, mesmo com pedidos simultâneos). Telas em `app/(app)/alunos/` com `ExigePlano`.

**Tech Stack:** Next 16.4.3, React 19, TypeScript estrito, CSS Modules, Supabase (service role), Vitest, Playwright (Chrome) com a API simulada, axe.

**Spec:** `docs/superpowers/specs/2026-10-26-cornerman-design.md` (decisões 1, 3, 9, 10, 15, 17, "Segurança e privacidade", etapa 2). Etapa 1 já entregue (`docs/plano-cornerman.md`).

## Global Constraints

- Antes de escrever rota ou página, ler o guia certo em `node_modules/next/dist/docs/` (`route.md`, `dynamic-routes.md`, `page.md`). Em rota dinâmica, `params` é uma Promise; usar `RouteContext<'/api/cornerman/alunos/[id]'>` (depois de `npx next typegen`).
- Limite: **20** fichas com `status` diferente de `encerrado`. Ficha `encerrado` não conta e pode ser reaberta (reabrir também respeita o limite).
- Ficha = nome (obrigatório, até **80**), e-mail (até **120**), telefone (até **30**), nível (`iniciante`, `intermediario` ou `avancado`), estilo (texto, até **40**), notas (até **2000**), foto (`isFoto`, até 60 000 caracteres, vazio = sem foto). Nada de plano sugerido nesta etapa.
- Toda rota: pedido que muda algo só vale se vier do próprio site (`prepararRota`); o usuário vem **sempre da sessão**; o plano é conferido **no servidor** em toda rota, inclusive nas de leitura; `Cache-Control: no-store`.
- Ficha de outro treinador, id inexistente e id malformado respondem **a mesma coisa**: 404 `nao_encontrado`, "Aluno não encontrado."
- A resposta monta a ficha campo a campo (lista de permitidos); nunca repassa a linha do banco (`coach_id`, `aluno_user_id` não saem; vira `comConta: boolean`).
- Registro de erros e mensagens: **nunca** e-mail, telefone, notas nem corpo do pedido.
- Notas e demais textos entram na tela como texto (React escapa), nunca como HTML.
- Sem biblioteca nova, sem Tailwind, CSS Modules, Phosphor só da lista oficial 2.1.1 (`tests/icones.test.ts`). Textos em português; avisos curtos em `lib/textos.ts`.
- Pagamento desligado no ambiente (sem `STRIPE_SECRET_KEY`): o app inteiro fica liberado e as rotas do treinador também (igual ao resto do app); isso tem teste.
- Arquivos do repositório usam CRLF: editar com a ferramenta de edição, não com `sed`/heredoc.
- Testes primeiro: ver cada teste falhar pelo motivo certo. `npm test` inteiro antes de cada commit. Commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Trabalho na branch `cornerman`. **Nada vai para `main` sem o OK explícito do Renan.**
- **Passo do Renan:** o SQL `supabase/cornerman-etapa-2.sql` precisa ser colado por ele no SQL Editor do Supabase (a chave secreta não executa SQL). Sem isso, só o teste de fumaça com o banco real fica pendente; o resto roda com banco de mentira.

## Review Focus

1. Treinador A nunca lê, altera nem apaga ficha do treinador B; corpo com `coach_id`, `aluno_user_id`, `status: 'convidado'`, `id` ou campo desconhecido é recusado, e id de outra conta responde igual a id inexistente. (Tasks 1, 2, 4)
2. A 21ª ficha é recusada mesmo com dois pedidos simultâneos; reabrir um encerrado também confere o limite; encerrado não conta. (Tasks 2, 6)
3. Gratuito, Iniciante, Amador, assinatura cancelada e atrasada além da tolerância recebem 403 em **todas** as rotas, inclusive GET; cookie de estado de outro usuário ou adulterado não vale; Stripe fora do ar responde 502 e não libera. (Task 3)
4. Nenhuma resposta de erro nem log contém e-mail, telefone ou notas; a resposta não traz colunas internas. (Tasks 2, 4)
5. Entradas estranhas: nome só com espaços, emoji, texto enorme, notas com `<script>`, e-mail e telefone inválidos, duplo clique em "Salvar" (cria uma ficha só), foto que não é JPEG. (Tasks 1, 5, 6)

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/cornerman-etapa-2.sql`, `supabase/schema.sql` | tabela `coach_alunos`, RLS, gatilho do limite |
| `lib/cornerman/ficha.ts` | tipos, limites e validação da ficha (puro) |
| `lib/cornerman/banco.ts` | `AlunosBancoLike` e a versão Supabase |
| `lib/cornerman/servico.ts` | regras: listar, criar, ler, atualizar, apagar |
| `lib/assinatura/estado-servidor.ts` | estado da assinatura no servidor (cookie ou Stripe), tirado da rota de estado |
| `lib/cornerman/acesso.ts` | `treinadorPodeGerir` (puro) e `prepararRotaDoTreinador` |
| `app/api/cornerman/alunos/route.ts`, `[id]/route.ts` | GET/POST e GET/PATCH/DELETE |
| `lib/cornerman/cliente.ts` | funções `fetch` tipadas usadas pelas telas |
| `components/FotoDePerfil.tsx` (editar), `components/FormularioDeAluno.tsx` (novo) | foto com `alt` configurável; formulário da ficha |
| `app/(app)/alunos/` (`page.tsx`, `AlunosCliente.tsx`, `novo/page.tsx`, `[id]/page.tsx`, `FichaCliente.tsx`, `alunos.module.css`) | lista, cadastro e ficha |
| `lib/navegacao.ts`, `components/PreferenciasCard.tsx`, `lib/textos.ts` (editar) | aba acesa, atalho no Perfil, avisos |

---

### Task 1: Regras e validação da ficha (puro)

**Files:**
- Create: `lib/cornerman/ficha.ts`, `tests/cornerman-ficha.test.ts`

**Interfaces:**
- Produces:
  - `export const LIMITE_DE_ALUNOS = 20`; `export const LIMITES_DA_FICHA = { nome: 80, email: 120, telefone: 30, estilo: 40, notas: 2000 } as const`
  - `export type StatusDaFicha = 'ativo' | 'convidado' | 'encerrado'`
  - `export interface DadosDaFicha { nome: string; email: string | null; telefone: string | null; nivel: Nivel | null; estilo: string | null; notas: string; foto: string }` (`Nivel` vem de `lib/onboarding`)
  - `export interface FichaDeAluno extends DadosDaFicha { id: string; status: StatusDaFicha; comConta: boolean; criadoEm: string; atualizadoEm: string }`
  - `export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string }`
  - `export function validarNovaFicha(corpo: unknown): Validacao<DadosDaFicha>`
  - `export function validarAtualizacao(corpo: unknown): Validacao<Partial<DadosDaFicha> & { status?: 'ativo' | 'encerrado' }>`
  - `export const ehIdDeFicha: (v: unknown) => v is string` (uuid) e `export const contarAtivas: (fichas: readonly { status: StatusDaFicha }[]) => number`

- [ ] **Step 1: Escrever os testes (devem falhar)** em `tests/cornerman-ficha.test.ts`
  - `validarNovaFicha`: `{ nome: 'Beto' }` vale e vira `{ nome: 'Beto', email: null, telefone: null, nivel: null, estilo: null, notas: '', foto: '' }`; nome com espaços nas pontas é aparado; vazio, só espaços, número, `null` e ausente recusam; nome de 81 caracteres recusa e de 80 vale; nome com emoji (`'🥊 Beto'`) vale; e-mail inválido (`'a@b'`, `'x'.repeat(121)+'@a.com'`) recusa, válido vale e `''` vira `null`; telefone com letras recusa, `'(11) 91234-5678'` vale, 31 caracteres recusa; nível fora da lista recusa; estilo de 41 caracteres recusa; notas de 2001 recusa e 2000 vale, notas com `<script>alert(1)</script>` **valem** (são texto); foto que não é JPEG em `data:` recusa (`isFoto`).
  - Campo desconhecido (`coach_id`, `aluno_user_id`, `status`, `id`, `__proto__`, `extra`) recusa **a ficha inteira** em `validarNovaFicha`; corpo que não é objeto (`null`, `'x'`, `[]`, `5`) recusa; a função não altera o objeto recebido.
  - `validarAtualizacao`: aceita qualquer subconjunto dos campos da ficha mais `status` `'ativo'`/`'encerrado'`; recusa `status: 'convidado'`, `status: 'x'`, objeto vazio (`{}`: nada para atualizar), `nome: ''`, campos desconhecidos; `nivel: null` e `estilo: ''` (vira `null`) valem.
  - `ehIdDeFicha`: aceita uuid, recusa `''`, `'1'`, `'../x'`, uuid com lixo no fim; `contarAtivas` ignora `encerrado` e conta `ativo` e `convidado`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-ficha.test.ts`
  Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `lib/cornerman/ficha.ts`** com as assinaturas acima. Reusar `emailValido` e `Nivel` de `lib/onboarding`, `isFoto` de `lib/dados/contrato`. Mensagens de erro em português e **sem repetir o valor recebido** (ex.: "O nome precisa ter de 1 a 80 caracteres."). Telefone: `^[0-9+()\-\s.]{0,30}$`.

- [ ] **Step 4: Rodar a suíte inteira**
  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/cornerman/ficha.ts tests/cornerman-ficha.test.ts
  git commit -m "Cornerman: regras e validação da ficha de aluno"
  ```

---

### Task 2: Banco, SQL e serviço das fichas

**Files:**
- Create: `supabase/cornerman-etapa-2.sql`, `lib/cornerman/banco.ts`, `lib/cornerman/servico.ts`, `tests/cornerman-servico.test.ts`, `tests/cornerman-banco.test.ts`
- Modify: `supabase/schema.sql`, `scripts/supabase-fumaca.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `export interface LinhaDeAluno { id: string; coach_id: string; nome: string; email: string | null; telefone: string | null; nivel: string | null; estilo: string | null; notas: string; foto: string; aluno_user_id: string | null; status: string; created_at: string; updated_at: string }` e `export interface AlunosBancoLike { listar(coachId: string): Promise<LinhaDeAluno[]>; obter(coachId: string, id: string): Promise<LinhaDeAluno | null>; inserir(coachId: string, dados: DadosDaFicha): Promise<LinhaDeAluno>; atualizar(coachId: string, id: string, campos: Record<string, unknown>): Promise<LinhaDeAluno | null>; apagar(coachId: string, id: string): Promise<boolean> }` em `lib/cornerman/banco.ts`; `export function criarAlunosBancoSupabase(db: SupabaseClient): AlunosBancoLike` (`import 'server-only'`). `inserir` e `atualizar` lançam `new Error('limite_de_alunos')` quando o gatilho do banco recusa (a mensagem do Postgres contém `limite_de_alunos`).
  - Em `lib/cornerman/servico.ts`: `export class ErroCornerman extends Error { constructor(readonly codigo: 'limite_de_alunos' | 'nao_encontrado' | 'dado_invalido', mensagem: string, readonly status: number) }` e
    `listarAlunos(banco, coachId): Promise<{ alunos: FichaDeAluno[]; ativos: number; limite: number }>`,
    `criarAluno(banco, coachId, corpo: unknown): Promise<FichaDeAluno>`,
    `lerAluno(banco, coachId, id: string): Promise<FichaDeAluno>`,
    `atualizarAluno(banco, coachId, id: string, corpo: unknown): Promise<FichaDeAluno>`,
    `apagarAluno(banco, coachId, id: string): Promise<void>`.

- [ ] **Step 1: Escrever os testes do serviço (devem falhar)** em `tests/cornerman-servico.test.ts` com um `BancoDeAlunosFalso` em memória (mesma semântica do banco real: cada treinador só enxerga as próprias linhas; o falso também aplica o limite de 20 no `inserir` e no `atualizar` para `ativo`, como o gatilho)
  - `criarAluno` devolve a ficha com `status: 'ativo'`, `comConta: false`, datas ISO, e **sem** `coach_id`/`aluno_user_id`/colunas do banco (`Object.keys` é exatamente a lista de `FichaDeAluno`); corpo inválido lança `ErroCornerman` `dado_invalido` (400) e não grava; a 21ª ficha lança `limite_de_alunos` (409) com texto "Você já tem 20 alunos. Encerre ou apague uma ficha para cadastrar outro."; com 20 fichas e uma `encerrado`, cadastrar mais uma passa (encerrado não conta).
  - `listarAlunos`: ativos primeiro em ordem alfabética sem diferenciar maiúsculas e acentos (`'Ávila'` antes de `'Beto'`), depois os encerrados; `ativos` e `limite` (20) corretos; lista vazia para treinador sem fichas.
  - Isolamento: `lerAluno`, `atualizarAluno` e `apagarAluno` com o id de ficha de **outro** treinador, com id inexistente e com id malformado (`'abc'`, `'../x'`) lançam o **mesmo** `ErroCornerman` `nao_encontrado` (404, "Aluno não encontrado.") e não alteram nada; um treinador não enxerga a lista do outro.
  - `atualizarAluno`: muda só os campos enviados; `status: 'encerrado'` libera uma vaga; reabrir (`'ativo'`) com 20 ativas lança `limite_de_alunos` e a ficha continua encerrada; `status: 'convidado'` e campos como `coach_id` lançam `dado_invalido`; `updated_at` avança.
  - `apagarAluno` remove de verdade (`lerAluno` depois dá `nao_encontrado`); apagar de novo dá `nao_encontrado`.
  - Falha do banco (qualquer `Error` que não seja o limite) sobe sem texto do corpo: `e.message` não contém o nome, e-mail, telefone nem as notas enviados.
  Em `tests/cornerman-banco.test.ts` (cliente do Supabase de mentira como em `tests/supabase-banco.test.ts`): toda leitura, atualização e apagamento filtra por `coach_id` **e** `id`; `inserir` grava `coach_id` do argumento (nunca de `dados`); a mensagem de erro do Postgres com `limite_de_alunos` vira `Error('limite_de_alunos')`, e qualquer outro erro vira `Error('Supabase (<onde>): …')` sem dados da ficha.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-servico.test.ts tests/cornerman-banco.test.ts`
  Expected: FAIL (módulos não existem).

- [ ] **Step 3: Escrever o SQL** `supabase/cornerman-etapa-2.sql` (idempotente, com o mesmo cabeçalho explicativo de `schema.sql`) e repetir o conteúdo em `supabase/schema.sql`:
  - `create table if not exists public.coach_alunos` com `id uuid primary key default gen_random_uuid()`, `coach_id text not null`, `nome text not null check (char_length(nome) between 1 and 80)`, `email text`, `telefone text`, `nivel text check (nivel in ('iniciante','intermediario','avancado'))`, `estilo text`, `notas text not null default ''`, `foto text not null default ''`, `aluno_user_id text` (vazio até a etapa 3), `status text not null default 'ativo' check (status in ('ativo','convidado','encerrado'))`, `created_at` e `updated_at timestamptz not null default now()`; índice em `(coach_id)`; RLS ligado, sem política, `revoke all … from anon, authenticated`.
  - Gatilho `before insert or update` (`public.coach_alunos_limite()`, `set search_path = public`): se `NEW.status <> 'encerrado'`, toma `pg_advisory_xact_lock(hashtext(NEW.coach_id))`, conta as outras linhas do mesmo `coach_id` (`id <> NEW.id`) com `status <> 'encerrado'` e, se já houver 20 ou mais, `raise exception 'limite_de_alunos'`. O limite 20 aparece uma vez, como constante no corpo da função, com comentário apontando para `LIMITE_DE_ALUNOS`.
  - Linhas finais de "para desfazer" no mesmo estilo do `schema.sql`.

- [ ] **Step 4: Implementar** `lib/cornerman/banco.ts` e `lib/cornerman/servico.ts`. O serviço valida com a Task 1, confere `ehIdDeFicha` antes de qualquer consulta, traduz linha em ficha campo a campo (`comConta: linha.aluno_user_id !== null`), pré-confere o limite com `contarAtivas` para dar a mensagem amigável e **também** trata `Error('limite_de_alunos')` do banco (a corrida entre dois pedidos), e ordena com `localeCompare(…, 'pt-BR', { sensitivity: 'base' })`.

- [ ] **Step 5: Ampliar `scripts/supabase-fumaca.ts`** (banco real) com um bloco do treinador: criar ficha e ler de volta (campos, foto e emoji iguais); dois treinadores de teste não se enxergam nem se alteram (404 igual); inserir 20 e ver a 21ª recusada; **duas inserções simultâneas na vaga 20** (`Promise.allSettled`): só uma entra; encerrar libera vaga; reabrir com 20 é recusado; apagar remove. Limpar as linhas no fim (`limpar()` passa a apagar também `coach_alunos` dos ids de teste) e `contarLinhas` conta a tabela nova.

- [ ] **Step 6: Rodar a suíte inteira e os tipos**
  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 7: Fumaça no banco real (depende do Renan colar o SQL)**
  Pedir ao Renan para rodar `supabase/cornerman-etapa-2.sql` no SQL Editor. Depois: `npm run supabase:fumaca`. Expected: tudo PASSOU, incluindo o bloco do treinador e "limpeza: nenhuma linha de teste ficou no banco". Se o SQL ainda não foi rodado, registrar como pendente e seguir (as Tasks 3 a 7 não dependem dele).

- [ ] **Step 8: Commit**
  ```bash
  git add supabase lib/cornerman tests/cornerman-*.test.ts scripts/supabase-fumaca.ts
  git commit -m "Cornerman: tabela de fichas com limite de 20 no banco, e o serviço das fichas"
  ```

---

### Task 3: Trava de plano no servidor

**Files:**
- Create: `lib/assinatura/estado-servidor.ts`, `lib/cornerman/acesso.ts`, `tests/cornerman-acesso.test.ts`
- Modify: `app/api/assinatura/estado/route.ts` (passa a usar `estado-servidor.ts`, comportamento idêntico)
- Test: `tests/assinatura-estado-servidor.test.ts`, `e2e/api-assinatura.spec.ts` (já cobre a rota de estado; deve continuar verde)

**Interfaces:**
- Produces:
  - `lib/assinatura/estado-servidor.ts` (`import 'server-only'`): `export type EstadoNoServidor = { pagamentoAtivo: false } | { pagamentoAtivo: true; estado: EstadoAssinatura; origem: 'cache' | 'stripe' }` e `export async function estadoNoServidor(usuario: UsuarioDoApp, opcoes: { forcar: boolean }): Promise<EstadoNoServidor>` — usa o cookie assinado de 5 min quando vale e `!forcar`; senão pergunta ao Stripe e renova o cookie; sem `STRIPE_SECRET_KEY` devolve `{ pagamentoAtivo: false }`; falha do Stripe **lança** (quem chama decide).
  - `lib/cornerman/acesso.ts`: `export function treinadorPodeGerir(e: EstadoNoServidor, agora?: Date): boolean` (puro: pagamento desligado vale `true`; senão `podeUsar('gestaoDeAlunos', e.estado, agora)`) e `export async function prepararRotaDoTreinador(request: Request, opcoes: { mutavel: boolean }): Promise<{ ok: true; usuario: UsuarioDoApp } | { ok: false; resposta: Response }>` — `prepararRota` (origem e sessão), depois o estado: Stripe falhou → 502 `falha_no_pagamento`; sem acesso → 403 `plano_insuficiente`, "Esta área é do plano Cornerman ou Profissional."

- [ ] **Step 1: Escrever os testes (devem falhar)**
  - `tests/cornerman-acesso.test.ts` (`treinadorPodeGerir`, estados montados à mão como em `tests/assinatura-regras.test.ts`): `true` para `ativa` e `teste` em `cornerman` e `profissional`, e para `atrasada` dentro dos 3 dias de tolerância; `false` para `iniciante`, `amador`, `SEM_ASSINATURA`, `cancelada` (de qualquer nível), teste vencido e `atrasada` além da tolerância; `{ pagamentoAtivo: false }` → `true`.
  - `tests/assinatura-estado-servidor.test.ts` (`vi.mock('server-only')` e `vi.mock('next/headers')` com um armazém de cookies falso, e o Stripe de mentira de `tests/assinatura-servico.test.ts`): cookie válido do mesmo usuário e `forcar: false` → origem `cache` sem chamar o Stripe; cookie de **outro** usuário, adulterado ou expirado → pergunta ao Stripe e grava cookie novo; `forcar: true` ignora o cookie; sem a chave do Stripe → `{ pagamentoAtivo: false }`; falha do Stripe lança.
  - E um teste da rota de estado existente continua passando sem mudar (rodar `e2e/api-assinatura.spec.ts` na Task 7).

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-acesso.test.ts tests/assinatura-estado-servidor.test.ts`
  Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar** movendo a lógica de `app/api/assinatura/estado/route.ts` (cookie, Stripe, `Set-Cookie` com `secure` conforme `x-forwarded-proto`) para `estado-servidor.ts`; a rota passa a só chamar `prepararRota`, `estadoNoServidor` e `responder`/`tratarErro`, devolvendo exatamente o mesmo JSON de antes (`pagamentoAtivo`, `estado`, `origem`). `acesso.ts` conforme as assinaturas.

- [ ] **Step 4: Rodar a suíte inteira e os tipos**
  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/assinatura/estado-servidor.ts lib/cornerman/acesso.ts app/api/assinatura/estado/route.ts tests
  git commit -m "Cornerman: trava de plano no servidor (estado da assinatura reaproveitado da rota de estado)"
  ```

---

### Task 4: Rotas da API

**Files:**
- Create: `app/api/cornerman/alunos/route.ts`, `app/api/cornerman/alunos/[id]/route.ts`, `e2e/api-cornerman.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 a 3. Respostas: `GET /api/cornerman/alunos` → `{ alunos, ativos, limite }`; `POST` (corpo = `DadosDaFicha` parcial) → 201 `{ aluno }`; `GET /api/cornerman/alunos/[id]` → `{ aluno }`; `PATCH` → `{ aluno }`; `DELETE` → `{ ok: true }`. Erros: `{ erro, codigo }` com os status do serviço, 401 sem sessão, 403 `origem_invalida` ou `plano_insuficiente`, 400 `pedido_invalido` para corpo ilegível e 413 para corpo grande (limite de **100 000 bytes**, via `lerCorpoJson(request, 100_000)`), 503 `nao_configurado` sem Supabase (como `/api/dados`).

- [ ] **Step 1: Escrever os testes de navegador da API (devem falhar)** em `e2e/api-cornerman.spec.ts` (usar `request` do Playwright como em `e2e/api-assinatura.spec.ts`; o servidor de teste não tem Stripe nem Supabase)
  - Sem sessão: GET e POST em `/api/cornerman/alunos` e GET/PATCH/DELETE em `/api/cornerman/alunos/<uuid>` respondem **401**.
  - Logado, POST/PATCH/DELETE com `origin: https://site-malicioso.com` respondem **403** `origem_invalida`.
  - Logado, mesmo site, sem Supabase: GET e POST respondem **503** `nao_configurado` (pagamento desligado libera o plano; o banco é que falta); id malformado em `/alunos/abc` responde **404** `nao_encontrado` antes de qualquer outra coisa; POST com corpo `'não é json'` responde 400 e com corpo de 200 KB responde 413.
  - Nenhuma resposta de erro contém o texto enviado (mandar um nome identificável e conferir que não volta).

- [ ] **Step 2: Rodar e ver falhar** (com `npm run build` feito)
  Run: `CI=1 npx playwright test e2e/api-cornerman.spec.ts --workers=1`
  Expected: FAIL (rotas não existem: 404 do Next).

- [ ] **Step 3: Implementar as rotas**, finas, no molde de `app/api/dados/route.ts`: `prepararRotaDoTreinador`, `getSupabase()` (null → 503), `lerCorpoJson`, chamada ao serviço com `criarAlunosBancoSupabase(db)` e `usuario.id`, `ErroCornerman` → `erro(codigo, mensagem, status)`, qualquer outro erro → `console.error` só com o nome do erro e 500 `erro_interno` genérico (nunca a mensagem do banco nem o corpo).

- [ ] **Step 4: Refazer o build e rodar**
  Run: `npm run build` e `CI=1 npx playwright test e2e/api-cornerman.spec.ts e2e/api-assinatura.spec.ts --workers=1`
  Expected: PASS (a rota de estado refatorada na Task 3 continua igual).

- [ ] **Step 5: Commit**
  ```bash
  git add app/api/cornerman e2e/api-cornerman.spec.ts
  git commit -m "Cornerman: rotas da API de alunos"
  ```

---

### Task 5: Lista "Meus Alunos" e cadastro

**Files:**
- Create: `lib/cornerman/cliente.ts`, `components/FormularioDeAluno.tsx`, `components/FormularioDeAluno.module.css`, `app/(app)/alunos/page.tsx`, `app/(app)/alunos/AlunosCliente.tsx`, `app/(app)/alunos/novo/page.tsx`, `app/(app)/alunos/alunos.module.css`, `e2e/alunos.spec.ts`
- Modify: `components/FotoDePerfil.tsx` (nova prop `alt?: string`, padrão `'Sua foto de perfil'`; sem foto continua `aria-hidden`), `lib/navegacao.ts` (`/alunos` pertence à aba `/perfil`), `components/PreferenciasCard.tsx` (atalho "Meus alunos" em "Ferramentas", só se `assinatura.podeUsar('gestaoDeAlunos')`), `lib/textos.ts`, `tests/navegacao.test.ts` (acrescentar o caso)

**Interfaces:**
- Consumes: rotas da Task 4; `ExigePlano` (`components/ConviteAoPlano.tsx`); `prepararFoto`; `FichaDeAluno`, `DadosDaFicha`, `LIMITE_DE_ALUNOS`, `LIMITES_DA_FICHA` (Task 1).
- Produces:
  - `lib/cornerman/cliente.ts`: `export type RespostaDaApi<T> = { ok: true; valor: T } | { ok: false; erro: string; codigo: string; status: number }` e `listarAlunosNoServidor(): Promise<RespostaDaApi<{ alunos: FichaDeAluno[]; ativos: number; limite: number }>>`, `criarAlunoNoServidor(dados: Partial<DadosDaFicha>): Promise<RespostaDaApi<FichaDeAluno>>`, `lerAlunoNoServidor(id: string)`, `atualizarAlunoNoServidor(id: string, campos: Record<string, unknown>)`, `apagarAlunoNoServidor(id: string)` (todos com `credentials: 'same-origin'`, `cache: 'no-store'`; falha de rede vira `{ ok: false, codigo: 'sem_conexao', status: 0, erro: 'Sem conexão. Verifique a internet e tente de novo.' }`).
  - `components/FormularioDeAluno.tsx`: `export default function FormularioDeAluno({ inicial, rotuloDoBotao, aoEnviar, ocupado, erro }: { inicial?: Partial<DadosDaFicha>; rotuloDoBotao: string; aoEnviar: (dados: DadosDaFicha) => void; ocupado: boolean; erro: string | null })` — campos com rótulo visível (nome obrigatório, e-mail, telefone, nível em `Segmentos`, estilo, notas em `textarea` com contador, foto com `prepararFoto` e os mesmos avisos da foto do perfil); `maxLength` de cada campo vem de `LIMITES_DA_FICHA`; botão desligado enquanto `ocupado` (impede o duplo clique).

- [ ] **Step 1: Escrever os testes de navegador (devem falhar)** em `e2e/alunos.spec.ts` (usa `./fixtures`, `simularEstado` de `./assinatura-simulada` e `pagina.route('**/api/cornerman/alunos*', …)` com uma "API" de mentira em memória que imita as respostas da Task 4)
  - `/alunos` com plano Amador e com gratuito: mostra o convite "Disponível a partir do plano Cornerman" com link "Ver planos" e **não** chama a API; com `ativa('cornerman')`, `ativa('profissional')`, `emTeste('cornerman')` e com pagamento `'indisponivel'`: mostra a lista.
  - Lista vazia: texto de estado vazio "Você ainda não cadastrou nenhum aluno." e botão "Novo aluno"; com 3 fichas: contador "3 de 20 alunos", cada cartão com nome, nível e o selo cinza "Ficha manual"; ordem alfabética; encerrada aparece só sob "Encerrados" (recolhido por padrão, abre ao clicar).
  - Com 20 ativas: o botão "Novo aluno" fica desligado com a explicação "Você chegou ao limite de 20 alunos."; `/alunos/novo` aberto direto com 20 mostra o aviso do servidor quando o POST devolve 409 `limite_de_alunos`.
  - Cadastro: preencher e enviar faz **um** POST com o corpo exato (`{ nome, email, telefone, nivel, estilo, notas, foto }`, sem campos a mais), volta para `/alunos` e mostra o aviso "Aluno cadastrado"; duplo clique rápido em "Cadastrar" gera um POST só; nome vazio mostra o erro "Informe o nome do aluno." sem chamar a API; erro 400 do servidor aparece em `role="alert"`; sem conexão mostra a mensagem de rede e mantém o que foi digitado.
  - Foto na ficha nova: escolher um PNG de 400×200 mostra a prévia 200×200 (`naturalWidth` 200) e o POST leva `data:image/jpeg;base64,`; arquivo que não é imagem mostra o aviso e não muda nada.
  - Notas com `<script>alert(1)</script>` aparecem como texto na ficha (a Task 6 cobre a ficha); no formulário, o `textarea` mantém o texto digitado.
  - Atalho no Perfil: com Cornerman o link "Meus alunos" aparece e leva a `/alunos`; com Amador não aparece; a aba **Perfil** fica acesa em `/alunos` (e em `/alunos/novo`).
  - axe sem violações em `/alunos` (vazia, com fichas, com convite de plano) e em `/alunos/novo`; formulário inteiro usável só com o teclado.

- [ ] **Step 2: Rodar e ver falhar** (`npm run build` antes)
  Run: `CI=1 npx playwright test e2e/alunos.spec.ts --workers=2`
  Expected: FAIL (páginas não existem).

- [ ] **Step 3: Implementar** o cliente, o formulário, a página `/alunos` (componente de servidor com `metadata`; o conteúdo em `AlunosCliente` dentro de `ExigePlano recurso="gestaoDeAlunos"`, carregando a lista só quando o plano libera), `/alunos/novo`, o atalho no Perfil, a aba acesa e os textos em `lib/textos.ts` (`alunoCadastrado`, `alunoAtualizado`, `alunoEncerrado`, `alunoReaberto`, `alunoApagado`). Cartões e lista em `alunos.module.css` (tema escuro oklch como as outras telas; 360 px sem rolagem horizontal; `overflow-wrap: anywhere` nos nomes). `tests/navegacao.test.ts`: `abaAtiva('/alunos')` e `abaAtiva('/alunos/abc')` = `/perfil`; `/alunosx` = `null`.

- [ ] **Step 4: Rodar a suíte inteira, o build e o navegador**
  Run: `npm test && npm run typecheck && npm run lint`, depois `npm run build` e `CI=1 npx playwright test e2e/alunos.spec.ts e2e/foto-perfil.spec.ts e2e/acessibilidade.spec.ts --workers=2`
  Expected: PASS.

- [ ] **Step 5: Conferir à mão em 360 px** (captura temporária como na etapa 1, apagada depois): lista com 3 fichas e uma foto, lista vazia, formulário. Dizer o que não foi conferido.

- [ ] **Step 6: Commit**
  ```bash
  git add lib app components e2e tests
  git commit -m "Cornerman: lista Meus Alunos e cadastro de ficha"
  ```

---

### Task 6: Ficha do aluno (ver, editar, notas, encerrar, reabrir, apagar)

**Files:**
- Create: `app/(app)/alunos/[id]/page.tsx`, `app/(app)/alunos/[id]/FichaCliente.tsx`, `app/(app)/alunos/[id]/ficha.module.css`
- Modify: `e2e/alunos.spec.ts`

**Interfaces:**
- Consumes: Task 5 (`cliente.ts`, `FormularioDeAluno`, `FotoDePerfil` com `alt`), `Segmentos` (`components/sheets/Segmentos`), `RespostaDaApi`.

- [ ] **Step 1: Escrever os testes de navegador (devem falhar)** em `e2e/alunos.spec.ts` (mesma API de mentira)
  - Abrir uma ficha: título com o nome, foto (ou inicial) com `alt` igual ao nome do aluno, nível, estilo, e-mail e telefone (como links `mailto:` e `tel:` só quando preenchidos), selo "Ficha manual · sem dados de treino" e duas abas em `role="tablist"`: "Visão geral" e "Notas".
  - Notas: editar e "Salvar notas" faz **um** PATCH só com `{ notas }`; o botão fica desligado enquanto salva e o aviso "Notas salvas" aparece; notas com `<script>alert(1)</script>` e com `<b>x</b>` aparecem como **texto** (nenhum elemento `script` ou `b` criado dentro da ficha; nenhum diálogo `alert` disparado); sair da aba com alteração não salva pergunta antes (usa `window.confirm`).
  - "Editar dados": abre o `FormularioDeAluno` preenchido; salvar faz PATCH só com os campos que mudaram; nome vazio é recusado na tela.
  - "Encerrar ficha": confirma, faz PATCH `{ status: 'encerrado' }`, a ficha passa a mostrar "Encerrada" e o botão "Reabrir"; "Reabrir" faz PATCH `{ status: 'ativo' }`; se a API responder 409 `limite_de_alunos`, mostra a mensagem e a ficha continua encerrada.
  - "Apagar ficha": confirma com o texto "Apagar de vez a ficha de <nome>? Isso não pode ser desfeito.", faz DELETE e volta a `/alunos` com o aviso "Ficha apagada"; o `window.confirm` cancelado não faz nada (testar com `pagina.once('dialog', d => d.dismiss())` antes do clique; o vigia do `fixtures` aceita diálogos por padrão, então registrar o handler do teste primeiro).
  - Id de ficha que a API responde 404: mostra "Aluno não encontrado." com link "Voltar para Meus Alunos" (nada de página quebrada); sem plano: o convite, sem chamar a API.
  - axe sem violações na ficha (visão geral, notas, editando, encerrada).

- [ ] **Step 2: Rodar e ver falhar**
  Run: `CI=1 npx playwright test e2e/alunos.spec.ts --workers=2`
  Expected: FAIL nos testes novos (página da ficha não existe).

- [ ] **Step 3: Implementar** a página (componente de servidor que repassa `id` de `params`, uma Promise, a `FichaCliente`) e a ficha, no mesmo estilo visual das outras telas; mensagens em `lib/textos.ts`.

- [ ] **Step 4: Rodar tudo da etapa**
  Run: `npm test && npm run typecheck && npm run lint`, `npm run build`, `CI=1 npx playwright test e2e/alunos.spec.ts e2e/api-cornerman.spec.ts e2e/acessibilidade.spec.ts --workers=2`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add "app/(app)/alunos" e2e lib/textos.ts
  git commit -m "Cornerman: ficha do aluno com dados, notas, encerrar, reabrir e apagar"
  ```

---

### Task 7: Fechamento da etapa

**Files:**
- Modify: `docs/plano-cornerman.md`, `docs/testes.md` (se listar os arquivos de teste), `docs/superpowers/specs/2026-10-26-cornerman-design.md` (marcar a etapa 2 como entregue)

- [ ] **Step 1: Documentar** em `docs/plano-cornerman.md` a seção "Etapa 2": o que o treinador faz, o limite de 20 e onde é garantido (gatilho no banco + conferência no serviço), a trava de plano no servidor e o cache de até 5 minutos, o passo do SQL, o que a ficha guarda e o que **não** guarda, privacidade (dados de terceiros, o treinador responde; entra no pacote LGPD), e as rotas da API.

- [ ] **Step 2: Verificação completa**
  Run: `npm run check` e `CI=1 npx playwright test --workers=2` (cerca de 20 min; se houver falhas, rodar de novo só as que falharam e dizer qual é o motivo de cada uma).
  Expected: tudo verde, ou cada falha explicada.

- [ ] **Step 3: Fumaça do Supabase real**, se o Renan já rodou o SQL (Task 2, Step 7); senão, dizer que está pendente.

- [ ] **Step 4: Revisão independente** da branch inteira desde o fim da etapa 1 (um revisor novo, avisando o Renan), com o Review Focus acima.

- [ ] **Step 5: Commit, push da branch e esperar o CI**
  ```bash
  git add docs
  git commit -m "Cornerman: documentação da etapa 2"
  git push origin cornerman
  ```
  Esperar o CI da branch ficar verde. **Não** publicar no `main` sem o OK do Renan (recomendação: publicar as etapas 1 e 2 juntas, junto com o ajuste do Timer).

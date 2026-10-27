# Cornerman, etapa 3a: convites e vínculo. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O treinador gera um link de convite para uma ficha; o aluno abre `/convite/<token>`, entra ou cria a conta e aceita; a ficha passa a ter vínculo com a conta dele ("Com conta"). O aluno vê e desfaz o vínculo em "Meu treinador" no Perfil. Esta etapa **não** mostra dados de treino do aluno ao treinador (é a etapa 3b).

**Architecture:** Tabela `coach_invites` (só o hash do token) e funções SQL atômicas (`criar_convite`, `cancelar_convite`, `aceitar_convite`, `desvincular_aluno`) chamadas pelo servidor. O índice único parcial em `coach_alunos(aluno_user_id)` garante "um treinador ativo por aluno" no banco. O token viaja até o aceite por um cookie curto (`corner_convite`) que o `proxy.ts` usa para levar o aluno de volta ao convite depois do login ou do onboarding. Regras em `lib/cornerman/convite-*.ts`, testáveis com banco de mentira; rotas finas.

**Tech Stack:** Next 16.4.3, React 19, TypeScript estrito, CSS Modules, Supabase (service role, SQL), Vitest, Playwright (Chrome), axe.

**Spec:** `docs/superpowers/specs/2026-10-26-cornerman-design.md` (decisões 7, 10, 15, 16, 17, 18; "Segurança e privacidade"; etapa 3, parte de convites e vínculo). Etapas 1 e 2 já entregues (`docs/plano-cornerman.md`).

## Global Constraints

- Antes de escrever rota, página ou `proxy.ts`, ler o guia certo em `node_modules/next/dist/docs/` (`route.md`, `proxy.md`, `dynamic-routes.md`). `params` é uma Promise; usar `RouteContext<'/api/…/[token]'>` (depois de `npx next typegen`).
- Token de convite: **32 bytes aleatórios** (`crypto.randomBytes`), texto base64url de **43 caracteres** (`^[A-Za-z0-9_-]{43}$`); no banco vai **só o hash SHA-256 em hex**. Vale **14 dias**, **uso único**. O token só aparece na resposta que o cria; nunca em log, nunca em mensagem de erro.
- Convite inexistente, expirado, já usado, cancelado e token malformado respondem **a mesma coisa**: 404 `convite_invalido`, "Convite inválido ou expirado."
- O aceite **não** compara o e-mail da conta com o da ficha (decisão 16): o link é a credencial. A tela do treinador avisa: "Quem abrir este link primeiro e aceitar fica vinculado ao aluno. Mande só para ele."
- Um treinador ativo por aluno: aluno que já tem treinador recebe 409 `ja_tem_treinador` ao aceitar outro convite. Treinador não aceita o próprio convite (400 `proprio_convite`).
- **Desvincular** (pelo aluno ou ao treinador encerrar a ficha): a ficha vira `encerrado`, `aluno_user_id` é limpo (o treinador perde todo acesso à conta), e **reabrir a ficha nunca restaura o vínculo**. Ficha em `convidado` não aceita mudança de status pelo PATCH (cancela-se o convite pela rota própria).
- Ficha `convidado` conta no limite de 20 (já conta hoje). Gerar convite para ficha `encerrado` reabre a vaga e passa pelo gatilho do limite.
- **E-mail do convite fica desligado** (decisão do Renan): a ficha mostra o botão "Enviar por e-mail" desligado, com a explicação "Envio por e-mail ainda não está disponível." Nenhum código de envio nesta etapa, nenhuma variável de ambiente nova.
- A página `/convite/<token>` mostra **só o primeiro nome do treinador**, nunca dados do aluno, e diz com clareza o que o treinador poderá ver depois de aceito (nome, foto, nível, estilo, resultado do quiz, plano ativo e treinos dos últimos 30 dias: data, tipo, rounds, esforço e duração) e o que **nunca** verá (lesões, peso, check-ins, pancadas na cabeça), e que o aluno pode se desvincular quando quiser.
- Registro de erros e respostas: nunca token, e-mail, telefone nem notas.
- TypeScript estrito, CSS Modules, Phosphor só da lista oficial 2.1.1 (`tests/icones.test.ts`), sem Tailwind e sem biblioteca nova. Textos em português; avisos e confirmações em `lib/textos.ts` (o teste `tests/textos-uso.test.ts` recusa texto solto em `showToast`, `window.confirm` e `setErro…(`).
- Arquivos usam CRLF: editar com a ferramenta de edição, não com `sed`/heredoc para código com aspas.
- Testes primeiro, vendo falhar pelo motivo certo. `npm test` inteiro antes de cada commit. Commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Trabalho na branch `cornerman`. **Nada vai para `main` sem o OK explícito do Renan.**
- **Passo do Renan:** colar `supabase/cornerman-etapa-3a.sql` no SQL Editor do Supabase (depois do `cornerman-etapa-2.sql`). Sem isso só a fumaça no banco real fica pendente.

## Rulings já tomados no plano (o spec manda; estes cobrem o que ele não diz)

- **Decisão 19 do desenho não se aplica:** o quiz **não guarda nada** no aparelho hoje (o resultado só existe em `/quiz?r=…`). Não há o que subir na primeira sincronização; quem já fez o quiz aparece como "sem quiz" para o treinador até refazê-lo. A guarda do quiz (entidade) fica para a etapa 3b.
- **"Limite de tentativas" do token:** o token tem 256 bits de aleatoriedade, então adivinhar é inviável e não há contador por IP (a Vercel é sem estado e o projeto não tem Redis). Custo se errado: um atacante com milhões de pedidos por segundo ainda não adivinha; o convite expira em 14 dias.
- **Convite por e-mail:** só o botão desligado (ver acima), por decisão do Renan.
- **Menor da etapa 2 incluída aqui (Task 1):** e-mail com `? & # %` recusado (evita Cc/Bcc escondido no `mailto:` agora que e-mails passam a vir de convites) e caracteres de controle, NUL e nome só de caracteres invisíveis recusados com 400 (antes davam 502 no banco).

## Review Focus

1. **Token:** impossível de adivinhar, só o hash no banco, uso único, expira; inexistente, expirado, usado, cancelado e malformado respondem idêntico; o token nunca aparece em log nem em erro, e só sai na resposta que o cria. (Tasks 2, 3, 4)
2. **Aceite atômico:** dois aceites ao mesmo tempo do mesmo convite: só um vence; aluno que já tem treinador é recusado (índice único no banco); treinador não aceita o próprio convite; ficha apagada invalida o convite. (Tasks 2, 4)
3. **Consentimento e desvínculo:** desvincular ou encerrar a ficha limpa o vínculo; reabrir não o restaura; PATCH de status em ficha `convidado` é recusado; gerar novo link invalida o anterior; o treinador não convida ficha que já tem conta nem ficha de outro treinador. (Tasks 1, 2, 3)
4. **Cookie e login:** o cookie `corner_convite` só é gravado para token válido, é HttpOnly, dura 1 hora e é apagado ao aceitar; o `proxy.ts` só redireciona `/hoje` para o convite quando há sessão **e** cookie bem formado (sem redirecionamento aberto); quem já está logado e abre `/convite/…` não é jogado para `/hoje`; a página pública não vaza nada além do primeiro nome do treinador. (Task 4)
5. **Entradas estranhas:** token com lixo, enorme ou com `../`; id de ficha de outra conta; dois cliques em "Gerar link" (um link válido só, o anterior morre); copiar sem permissão de área de transferência; aceitar sem estar logado; convite aberto pelo próprio treinador. (Tasks 3, 4, 5, 6)

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/cornerman-etapa-3a.sql`, `supabase/schema.sql` | `coach_invites`, índice único parcial, funções SQL |
| `lib/cornerman/ficha.ts`, `servico.ts` (editar) | validação mais estrita; regras de `convidado` e de encerrar com vínculo |
| `lib/cornerman/convite.ts` | constantes e funções puras do convite (cliente e servidor) |
| `lib/cornerman/convite-token.ts` | gerar e hashear token (servidor) |
| `lib/cornerman/convite-banco.ts`, `convite-servico.ts` | banco (Supabase) e regras do convite e do vínculo |
| `lib/cornerman/acesso.ts` (usar), `lib/cornerman/aluno-rota.ts` (novo) | checagens comuns das rotas do aluno (sessão, origem) |
| `app/api/cornerman/alunos/[id]/convite/route.ts` | POST gera, DELETE cancela |
| `app/api/convite/[token]/route.ts`, `…/guardar/route.ts`, `…/aceitar/route.ts` | consulta pública, cookie e aceite |
| `app/api/meu-treinador/route.ts` | GET e DELETE (desvincular) |
| `proxy.ts` (editar) | `/convite/…` público para todos; `/hoje` com cookie leva ao convite |
| `app/convite/[token]/` (novo) | página pública do convite |
| `app/(app)/alunos/[id]/FichaCliente.tsx`, `AlunosCliente.tsx` (editar), `ConviteDaFicha.tsx` (novo) | seção "Convite" na ficha, selos na lista |
| `components/MeuTreinador.tsx` (novo), `app/(app)/perfil/page.tsx` (editar) | "Meu treinador" no Perfil do aluno |
| `lib/cornerman/cliente.ts`, `lib/textos.ts` (editar) | chamadas e textos |

---

### Task 1: Validação mais estrita e regras de status da ficha

**Files:**
- Modify: `lib/cornerman/ficha.ts`, `lib/cornerman/servico.ts`
- Test: `tests/cornerman-ficha.test.ts`, `tests/cornerman-servico.test.ts`

**Interfaces:**
- Consumes: `AlunosBancoLike` (etapa 2). A linha do banco já tem `aluno_user_id` e `status`.
- Produces: `ErroCornerman` ganha os códigos `'convite_invalido' | 'proprio_convite' | 'ja_tem_treinador' | 'convite_pendente' | 'nao_convidavel'` (tipo `Codigo` em `servico.ts`, exportado como `CodigoCornerman`). `atualizarAluno`: (a) com `status` no corpo e a ficha em `convidado`, lança `ErroCornerman('convite_pendente', 'Cancele o convite antes de mudar o status da ficha.', 409)` sem gravar; (b) com `status: 'encerrado'` e a ficha com `aluno_user_id`, grava também `aluno_user_id: null`.

- [ ] **Step 1: Escrever os testes (devem falhar)**
  - `cornerman-ficha.test.ts`: e-mail com `?`, `&`, `#` ou `%` recusado (`'x?bcc=a@b.com@c.com'`, `'a&b@c.com'`, `'a#b@c.com'`, `'a%b@c.com'`); e-mail normal com `+`, `.`, `-` e `_` continua valendo. Em todos os campos de texto (nome, e-mail, telefone, estilo e notas): NUL (`'\u0000'`) e caracteres de controle (`'\u0007'`, `'\u001b'`) recusados, mas `\n` e `\t` valem **nas notas**; substituto solto (`'\uD800'` sem par) recusado. Nome só de caracteres invisíveis (`'​'`, `'​​'`, `'⁠'`, `'﻿'`) recusado; `'🥊'` e `'Zé'` valem.
  - `cornerman-servico.test.ts` (o `BancoDeAlunosFalso` já existente): ficha em `convidado` (fabricar a linha direto no falso) + `{ status: 'ativo' }` e `{ status: 'encerrado' }` lançam `convite_pendente` (409) e não gravam, mas `{ notas: 'x' }` na mesma ficha vale; ficha `ativo` com `aluno_user_id: 'u_aluno'` + `{ status: 'encerrado' }` termina `encerrado` e com `aluno_user_id` nulo (`comConta: false`); depois `{ status: 'ativo' }` volta `ativo` **sem** vínculo; encerrar ficha sem vínculo continua igual.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-ficha.test.ts tests/cornerman-servico.test.ts`
  Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar** a rejeição em `lerCampo`/`textoOpcional` (um helper `textoLimpo(v, { multilinha })`) e a regra de e-mail em `ficha.ts`; `atualizarAluno` passa a ler a ficha antes (`banco.obter`) e aplica as duas regras acima. Mensagens sem repetir o valor.

- [ ] **Step 4: Rodar a suíte inteira e os tipos**
  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/cornerman tests
  git commit -m "Cornerman: validação mais estrita da ficha e regras de status com convite e vínculo"
  ```

---

### Task 2: SQL, token e serviço do convite

**Files:**
- Create: `supabase/cornerman-etapa-3a.sql`, `lib/cornerman/convite.ts`, `lib/cornerman/convite-token.ts`, `lib/cornerman/convite-banco.ts`, `lib/cornerman/convite-servico.ts`, `tests/cornerman-convite.test.ts`, `tests/cornerman-convite-servico.test.ts`, `tests/cornerman-convite-banco.test.ts`
- Modify: `supabase/schema.sql`, `scripts/supabase-fumaca.ts`

**Interfaces:**
- Consumes: Task 1 (`ErroCornerman`, códigos novos), `ehIdDeFicha`.
- Produces:
  - `lib/cornerman/convite.ts` (puro): `VALIDADE_DO_CONVITE_DIAS = 14`, `COOKIE_DO_CONVITE = 'corner_convite'`, `VALIDADE_DO_COOKIE_SEGUNDOS = 3600`, `ehTokenDeConvite(v: unknown): v is string` (`^[A-Za-z0-9_-]{43}$`), `expiraEm(agora: Date): string` (ISO, `agora` + 14 dias), `linkDoConvite(origem: string, token: string): string` (`${origem}/convite/${token}`).
  - `lib/cornerman/convite-token.ts` (`import 'server-only'`): `novoToken(): { token: string; hash: string }` e `hashDoToken(token: string): string` (SHA-256 hex, minúsculo, 64 caracteres).
  - `lib/cornerman/convite-banco.ts` (`import 'server-only'`): `export interface ConvitesBancoLike { criarConvite(coachId: string, alunoId: string, hash: string, expiraEm: string): Promise<void>; cancelarConvite(coachId: string, alunoId: string): Promise<boolean>; convitePendente(coachId: string, alunoId: string): Promise<{ expiraEm: string } | null>; consultarConvite(hash: string): Promise<{ coachId: string; nomeDoTreinador: string | null } | null>; aceitarConvite(hash: string, alunoUserId: string): Promise<{ coachId: string }>; desvincular(alunoUserId: string): Promise<number>; treinadorDoAluno(alunoUserId: string): Promise<{ nome: string | null } | null> }` e `criarConvitesBancoSupabase(db: SupabaseClient): ConvitesBancoLike`. Erros do SQL viram `Error` com a mensagem exata: `limite_de_alunos`, `nao_convidavel`, `nao_encontrado`, `convite_invalido`, `proprio_convite`, `ja_tem_treinador`; qualquer outro vira `Supabase (<onde>): …` sem dados.
  - `lib/cornerman/convite-servico.ts`: `criarConviteDaFicha(banco: ConvitesBancoLike, coachId: string, alunoId: string, origem: string, agora?: Date): Promise<{ link: string; expiraEm: string }>`; `cancelarConviteDaFicha(banco, coachId, alunoId): Promise<void>`; `convitePendenteDaFicha(banco, coachId, alunoId): Promise<{ expiraEm: string } | null>`; `consultarConvite(banco, token: string): Promise<{ valido: true; treinador: string } | { valido: false }>`; `aceitarConvite(banco, token: string, alunoUserId: string): Promise<{ treinador: string }>`; `meuTreinador(banco, alunoUserId): Promise<{ nome: string } | null>`; `desvincularDoTreinador(banco, alunoUserId): Promise<void>`.

- [ ] **Step 1: Escrever os testes (devem falhar)**
  - `cornerman-convite.test.ts` (puro e token): `ehTokenDeConvite` aceita 43 caracteres base64url e recusa 42, 44, com `/`, `+`, `=`, espaço, `../x`, vazio, `null`; `expiraEm(new Date('2026-10-27T12:00:00Z'))` = `'2026-11-10T12:00:00.000Z'`; `linkDoConvite('https://corner2.vercel.app', t)` = `https://corner2.vercel.app/convite/<t>`; `novoToken()` devolve token que passa em `ehTokenDeConvite`, `hash` de 64 hex que é o SHA-256 do token, e duas chamadas dão tokens diferentes (100 chamadas, 100 únicos); `hashDoToken` é determinístico e `hashDoToken(token) !== token`.
  - `cornerman-convite-servico.test.ts` com um `BancoDeConvitesFalso` em memória que imita as funções SQL (fichas e convites num `Map`; regras: criar convite só em ficha do treinador, sem conta, `ativo` ou `encerrado`, e apaga os convites anteriores da ficha; ficha vira `convidado`; limite de 20 como o gatilho; aceitar atômico e de uso único; `aluno_user_id` único entre fichas não encerradas; desvincular encerra e limpa):
    - **criar:** devolve `{ link, expiraEm }` com link no formato certo e token válido; o banco só recebe o **hash** (o token nunca está em nenhuma linha do falso); expira em 14 dias; gerar de novo faz o link **antigo** parar de valer (consultar o antigo = `valido: false`); ficha de outro treinador, id inexistente e id malformado dão o **mesmo** `nao_encontrado` 404 "Aluno não encontrado."; ficha com conta dá `nao_convidavel` 409 "Esta ficha já está vinculada a uma conta."; com 20 fichas ativas e a ficha encerrada, gerar convite dá `limite_de_alunos` 409 e a ficha continua encerrada.
    - **cancelar:** ficha volta a `ativo`, link para de valer; sem convite pendente → 404 `nao_encontrado`.
    - **consultar:** válido → `{ valido: true, treinador: <primeiro nome> }` (nome "Marcos Silva" → "Marcos"; sem nome → "Um treinador"); inexistente, malformado (`'abc'`, `'../x'`, 42, `null`), expirado (relógio avançado), usado e cancelado → o **mesmo** `{ valido: false }`.
    - **aceitar:** ficha vira `ativo` com `aluno_user_id`; a segunda tentativa com o mesmo token dá `convite_invalido` 404 "Convite inválido ou expirado."; **dois aceites ao mesmo tempo** (`Promise.allSettled`) de dois usuários: um vence, o outro `convite_invalido`; treinador aceitando o próprio convite → `proprio_convite` 400 "Você não pode aceitar o seu próprio convite." e o convite continua válido; aluno que já tem treinador ativo → `ja_tem_treinador` 409 "Você já tem um treinador. Desvincule-se dele no Perfil antes de aceitar outro convite." e o convite continua válido; token expirado/malformado → `convite_invalido`.
    - **vínculo:** `meuTreinador` devolve o nome (`{ nome: 'Marcos' }`) ou `null`; `desvincularDoTreinador` encerra a ficha, limpa `aluno_user_id`, o treinador não vê mais `comConta` e **reaceitar um convite novo** funciona; desvincular sem treinador não dá erro; reabrir a ficha pelo `atualizarAluno` (etapa 2) **não** restaura o vínculo.
    - erro qualquer do banco sobe sem token, hash, nome nem e-mail na mensagem.
  - `cornerman-convite-banco.test.ts` (cliente do Supabase de mentira com `rpc` e `from`): cada função chama a RPC certa (`criar_convite`, `cancelar_convite`, `aceitar_convite`, `desvincular_aluno`) com `p_coach`/`p_aluno`/`p_hash`/`p_expira`/`p_user` e **nunca** com o token; mensagens do Postgres (`limite_de_alunos`, `nao_convidavel`, `nao_encontrado`, `convite_invalido`, `proprio_convite`, `ja_tem_treinador`) viram `Error` com a mensagem exata; outro erro vira `Supabase (<onde>): …`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-convite.test.ts tests/cornerman-convite-servico.test.ts tests/cornerman-convite-banco.test.ts`
  Expected: FAIL (módulos não existem).

- [ ] **Step 3: Escrever o SQL** `supabase/cornerman-etapa-3a.sql` (idempotente, mesmo cabeçalho e padrão da etapa 2) e repetir em `schema.sql`:
  - `coach_invites(id uuid pk default gen_random_uuid(), coach_id text not null, aluno_id uuid not null references public.coach_alunos(id) on delete cascade, token_hash text not null unique, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now())`, índice em `aluno_id`, RLS ligado sem política, `revoke all … from anon, authenticated`.
  - `create unique index if not exists coach_alunos_aluno_user_ativo_idx on public.coach_alunos (aluno_user_id) where aluno_user_id is not null and status <> 'encerrado'` (um treinador ativo por aluno).
  - Funções `plpgsql`, `security definer` não (rodam com a chave de serviço), `set search_path = public`, `revoke all … from public, anon, authenticated` e `grant execute … to service_role`:
    - `criar_convite(p_coach text, p_aluno uuid, p_hash text, p_expira timestamptz) returns void`: trava a ficha (`select … for update` onde `id = p_aluno and coach_id = p_coach`; não achou: `raise exception 'nao_encontrado'`); se `aluno_user_id is not null` ou `status = 'convidado'` com conta, `raise exception 'nao_convidavel'`; apaga os convites não usados da ficha; insere o novo; `update … set status = 'convidado', updated_at = now()` (o gatilho do limite pode levantar `limite_de_alunos`).
    - `cancelar_convite(p_coach text, p_aluno uuid) returns boolean`: se a ficha é do treinador e está `convidado`, apaga os convites, põe `status = 'ativo'` e devolve `true`; senão `false`.
    - `aceitar_convite(p_hash text, p_user text) returns text` (devolve o `coach_id`): trava o convite junto da ficha (`for update`); não existe, `used_at` preenchido ou `expires_at < now()` → `raise exception 'convite_invalido'`; `coach_id = p_user` → `raise exception 'proprio_convite'`; marca `used_at = now()`; `update coach_alunos set aluno_user_id = p_user, status = 'ativo'` com `exception when unique_violation then raise exception 'ja_tem_treinador'` (a transação inteira desfaz, o convite continua válido).
    - `desvincular_aluno(p_user text) returns integer`: `update coach_alunos set aluno_user_id = null, status = 'encerrado', updated_at = now() where aluno_user_id = p_user and status <> 'encerrado'`; devolve quantas linhas.
  - Linhas finais de "para desfazer" no mesmo estilo.

- [ ] **Step 4: Implementar** os quatro módulos conforme as assinaturas. `convite-servico.ts` traduz `Error('limite_de_alunos')`, `nao_convidavel`, `nao_encontrado`, `convite_invalido`, `proprio_convite` e `ja_tem_treinador` em `ErroCornerman` (status e textos acima); valida o token com `ehTokenDeConvite` e o id com `ehIdDeFicha` **antes** de tocar no banco; o nome do treinador vem de `profiles.name` (primeira palavra) em `consultarConvite` e `treinadorDoAluno`. Qualquer outro erro sobe como está.

- [ ] **Step 5: Ampliar `scripts/supabase-fumaca.ts`** com um bloco "convites" (pula com aviso se `coach_invites` não existir): gerar convite e consultar; gerar de novo mata o antigo; **dois aceites simultâneos** de dois usuários (só um vence); o mesmo aluno aceitando convites de dois treinadores (o segundo recusado pelo índice único); treinador não aceita o próprio; desvincular encerra e limpa; reaceite funciona; convite expirado (ajustar `expires_at` pelo cliente de serviço) vira inválido; o token nunca aparece em nenhuma coluna (`select *` em `coach_invites` não contém o texto do token). `limpar()` e `contarLinhas` incluem `coach_invites`.

- [ ] **Step 6: Rodar a suíte inteira e os tipos**
  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 7: Fumaça no banco real (depende do Renan colar o SQL)**
  Pedir ao Renan para rodar `supabase/cornerman-etapa-3a.sql`. Depois: `npm run supabase:fumaca`. Expected: tudo PASSOU, incluindo os blocos das etapas 2 e 3a. Sem o SQL, registrar como pendente e seguir.

- [ ] **Step 8: Commit**
  ```bash
  git add supabase lib/cornerman tests scripts/supabase-fumaca.ts
  git commit -m "Cornerman: convites com token de uso único, aceite atômico e vínculo no banco"
  ```

---

### Task 3: Rotas do treinador para o convite

**Files:**
- Create: `app/api/cornerman/alunos/[id]/convite/route.ts`
- Modify: `app/api/cornerman/alunos/[id]/route.ts` (o GET passa a devolver também o convite pendente), `lib/cornerman/http.ts` (se precisar de mais códigos), `lib/cornerman/cliente.ts`
- Test: `e2e/api-cornerman.spec.ts`, `tests/cornerman-cliente.test.ts`

**Interfaces:**
- Consumes: Task 2, `prepararRotaDoTreinador`, `origemDoSite` de `lib/assinatura/http`.
- Produces: `POST /api/cornerman/alunos/[id]/convite` → 201 `{ link, expiraEm }`; `DELETE` → `{ ok: true }`; `GET /api/cornerman/alunos/[id]` → `{ aluno, convite: { expiraEm: string } | null }`. Em `cliente.ts`: `lerAlunoNoServidor(id): Promise<RespostaDaApi<{ aluno: FichaDeAluno; convite: { expiraEm: string } | null }>>` (muda o tipo de retorno; ajustar `FichaCliente`), `gerarConviteNoServidor(id): Promise<RespostaDaApi<{ link: string; expiraEm: string }>>`, `cancelarConviteNoServidor(id): Promise<RespostaDaApi<true>>`.

- [ ] **Step 1: Escrever os testes (devem falhar)**
  - `e2e/api-cornerman.spec.ts` (acrescentar): sem sessão, POST e DELETE em `/api/cornerman/alunos/<uuid>/convite` respondem 401; logado com `Origin` de outro site ou sem `Origin`, 403 `origem_invalida`; id que não é uuid, 404 `nao_encontrado` antes de tocar no banco; sem Supabase, 503 `nao_configurado`; nenhuma resposta repete o que foi enviado.
  - `tests/cornerman-cliente.test.ts`: `gerarConviteNoServidor` faz `POST /api/cornerman/alunos/<id>/convite` sem corpo; `cancelarConviteNoServidor` faz `DELETE`; `lerAlunoNoServidor` devolve `{ aluno, convite }` e trata `convite` ausente como `null`; resposta sem `aluno` continua virando `resposta_invalida`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-cliente.test.ts` e, com o build feito, `CI=1 npx playwright test e2e/api-cornerman.spec.ts --workers=1`
  Expected: FAIL.

- [ ] **Step 3: Implementar** a rota nova no molde das de `[id]`: `prepararRotaDoTreinador` (mutável), `ehIdDeFicha` → 404, `getSupabase()` → 503, `criarConviteDaFicha(criarConvitesBancoSupabase(db), usuario.id, id, origemDoSite(request))`; o GET de `[id]` chama também `convitePendenteDaFicha`. Erros via `respostaDeErroDoCornerman`. Resposta com `Cache-Control: no-store`.

- [ ] **Step 4: Refazer o build e rodar**
  Run: `npm test && npm run typecheck && npm run lint`, `npm run build`, `CI=1 npx playwright test e2e/api-cornerman.spec.ts e2e/alunos.spec.ts --workers=2`
  Expected: PASS (ajustar o simulador `e2e/alunos-simulados.ts` para o GET devolver `convite: null`).

- [ ] **Step 5: Commit**
  ```bash
  git add app/api lib/cornerman e2e tests
  git commit -m "Cornerman: rotas do treinador para gerar e cancelar o convite"
  ```

---

### Task 4: Rotas públicas do convite, "Meu treinador" e o `proxy.ts`

**Files:**
- Create: `lib/cornerman/aluno-rota.ts`, `app/api/convite/[token]/route.ts`, `app/api/convite/[token]/guardar/route.ts`, `app/api/convite/[token]/aceitar/route.ts`, `app/api/meu-treinador/route.ts`, `tests/cornerman-proxy.test.ts`, `e2e/api-convite.spec.ts`
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: Task 2; `prepararRota` (sessão e origem); `COOKIE_DO_CONVITE`, `VALIDADE_DO_COOKIE_SEGUNDOS`, `ehTokenDeConvite`.
- Produces:
  - `GET /api/convite/[token]` (público, sem sessão): `{ valido: true, treinador: string, logado: boolean }` ou `{ valido: false, logado: boolean }`, sempre 200 e `no-store`; token malformado também dá `{ valido: false, … }` (200, igual).
  - `POST /api/convite/[token]/guardar` (só do próprio site; sem sessão): token válido → grava o cookie `corner_convite` (HttpOnly, `sameSite: 'lax'`, `path: '/'`, `maxAge` 3600, `secure` conforme `x-forwarded-proto`) e devolve `{ ok: true }`; inválido → 404 `convite_invalido` e **não** grava cookie.
  - `POST /api/convite/[token]/aceitar` (sessão + própria origem): `{ ok: true, treinador }` e apaga o cookie `corner_convite`; erros 404 `convite_invalido`, 400 `proprio_convite`, 409 `ja_tem_treinador`.
  - `GET /api/meu-treinador` (sessão): `{ treinador: { nome: string } | null }`; `DELETE` (sessão + origem): `{ ok: true }` (idempotente).
  - `lib/cornerman/aluno-rota.ts`: `prepararRotaDoAluno(request, { mutavel })` = `prepararRota` + `getSupabase()` (503 `nao_configurado`), devolve `{ ok: true; usuario; db } | { ok: false; resposta }`.
  - `proxy.ts`: **(a)** `/convite/<algo>` é público para quem está e para quem não está logado (hoje rotas públicas mandam o logado para `/hoje`); **(b)** logado, com cookie `corner_convite` de formato válido, abrindo `/hoje` → redireciona para `/convite/<token do cookie>`; cookie malformado é ignorado; **(c)** o resto como hoje. Extrair a decisão para uma função pura exportada `decidirRota({ caminho, logado, cookieDoConvite }): { tipo: 'seguir' } | { tipo: 'redirecionar'; para: string }` em `lib/cornerman/proxy-regras.ts` (que o `proxy.ts` chama), para testar sem o Next.

- [ ] **Step 1: Escrever os testes (devem falhar)**
  - `tests/cornerman-proxy.test.ts` (`decidirRota`): sem sessão em `/hoje` → `/login`; sem sessão em `/convite/<token>` → segue; com sessão em `/convite/<token>` → segue (não vai para `/hoje`); com sessão em `/login` e `/onboarding` → `/hoje` (como antes); com sessão em `/hoje` **sem** cookie → segue; com sessão em `/hoje` e cookie válido → `/convite/<token>`; com cookie malformado (`'../x'`, `'abc'`, 44 caracteres, `'https://mau.com'`, `'//mau.com'`) → segue em `/hoje` (nenhum redirecionamento aberto); com cookie válido em `/plano` ou `/perfil` → segue (só `/hoje` é desviado); sem sessão e com cookie em `/login` → segue; `/convite` sem token e `/conviteX/abc` não são públicos.
  - `e2e/api-convite.spec.ts` (API real, sem Supabase): `GET /api/convite/<token qualquer>` responde 200 `{ valido: false, logado: false }` sem sessão; token malformado (`abc`, `../x`, 44 caracteres) igual; logado, `logado: true`; `POST …/guardar` de outro site ou sem `Origin` → 403 e **sem** `Set-Cookie`; com token malformado → 404 `convite_invalido` sem `Set-Cookie`; com token bem formado e sem Supabase → 503 sem `Set-Cookie`; `POST …/aceitar` sem sessão 401, com origem errada 403, token malformado 404, sem Supabase 503; `GET` e `DELETE /api/meu-treinador` sem sessão 401, `DELETE` de outro site 403, logado sem Supabase 503 (GET) e 503 (DELETE); logado, abrir `/convite/<token>` **não** redireciona para `/hoje` (a página existe depois da Task 6; aqui basta `/hoje` com cookie manual redirecionar: com `context.addCookies([{ name: 'corner_convite', value: <43 caracteres>, url }])`, `goto('/hoje')` termina em `/convite/<token>`; com cookie malformado termina em `/hoje`); nenhuma resposta repete o token enviado no corpo de erro.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/cornerman-proxy.test.ts` e, com o build, `CI=1 npx playwright test e2e/api-convite.spec.ts --workers=1`
  Expected: FAIL.

- [ ] **Step 3: Implementar** `proxy-regras.ts` + `proxy.ts`, `aluno-rota.ts` e as quatro rotas (finas, no molde das anteriores; `GET /api/convite/[token]` lê a sessão só para dizer `logado`, sem exigir). Erros via `respostaDeErroDoCornerman`; nunca ecoar o token.

- [ ] **Step 4: Rodar tudo da tarefa**
  Run: `npm test && npm run typecheck && npm run lint`, `npm run build`, `CI=1 npx playwright test e2e/api-convite.spec.ts e2e/api-cornerman.spec.ts e2e/onboarding.spec.ts e2e/acesso.spec.ts --workers=2`
  Expected: PASS (o login e o onboarding existentes continuam iguais).

- [ ] **Step 5: Commit**
  ```bash
  git add proxy.ts lib/cornerman app/api tests e2e
  git commit -m "Cornerman: rotas públicas do convite, Meu treinador e o proxy que leva o aluno de volta ao convite"
  ```

---

### Task 5: Seção "Convite" na ficha e selos na lista

**Files:**
- Create: `app/(app)/alunos/[id]/ConviteDaFicha.tsx`, `app/(app)/alunos/[id]/convite.module.css`
- Modify: `app/(app)/alunos/[id]/FichaCliente.tsx`, `app/(app)/alunos/AlunosCliente.tsx`, `e2e/alunos-simulados.ts`, `e2e/alunos.spec.ts`, `lib/textos.ts`

**Interfaces:**
- Consumes: Task 3 (`gerarConviteNoServidor`, `cancelarConviteNoServidor`, `lerAlunoNoServidor` com `convite`).
- Produces: `ConviteDaFicha({ ficha, convite, aoMudar }: { ficha: FichaDeAluno; convite: { expiraEm: string } | null; aoMudar: () => void })` mostra, conforme o estado: ficha **com conta** (`comConta`): "Vinculado a uma conta do Corner." sem botões de convite; ficha **convidado** (convite pendente): "Convite pendente, expira em dd/mm" + "Gerar novo link" + "Cancelar convite"; ficha **ativo ou encerrado** sem conta: "Convidar para o Corner" + "Gerar link de convite". Depois de gerar: o link num campo somente leitura, "Copiar link" (aviso "Link copiado"; se a área de transferência negar, seleciona o texto e avisa "Não foi possível copiar. Selecione e copie o link."), "Compartilhar" (`navigator.share` se existir; senão um link `https://wa.me/?text=…` com o texto "Convite do seu treinador no Corner: <link>"), o aviso "Quem abrir este link primeiro e aceitar fica vinculado ao aluno. Mande só para ele." e o botão **desligado** "Enviar por e-mail" ligado por `aria-describedby` ao texto "Envio por e-mail ainda não está disponível." O link só existe na tela logo depois de gerado (o servidor não guarda o token): recarregar a página mostra "Convite pendente" sem o link e oferece "Gerar novo link".
- Selos da lista (`AlunosCliente`): `convidado` → "Convidado"; `ativo` com `comConta` → "Com conta"; encerrada → "Encerrada"; resto "Ficha manual". Na ficha, o selo do topo segue a mesma regra, e o texto "Ficha manual · sem dados de treino" só vale para ficha sem conta.
- Em `FichaCliente`: encerrar uma ficha `comConta` usa a confirmação `TEXTOS.confirmar.encerrarFichaComConta(nome)`: "Encerrar a ficha de <nome>? O vínculo com a conta dele acaba e você perde o acesso aos dados de treino dele. Para vincular de novo, será preciso um convite novo." Ficha `convidado` não mostra "Encerrar ficha" nem "Reabrir ficha" (o PATCH recusa): mostra só "Editar dados" e "Apagar ficha".

- [ ] **Step 1: Escrever os testes de navegador (devem falhar)** em `e2e/alunos.spec.ts`, com o simulador de API ampliado (`POST/DELETE …/convite`, `GET [id]` com `convite`, fichas `convidado` e `comConta`; o simulador gera um token falso de 43 caracteres e registra os pedidos)
  - Ficha manual: seção "Convidar para o Corner" com "Gerar link de convite"; clicar faz **um** POST, mostra o link (`/convite/<43 caracteres>`) num campo somente leitura, o aviso do primeiro-que-aceita e o botão "Enviar por e-mail" **desligado** com a explicação; a ficha passa a "Convidado" e o selo muda.
  - Duplo clique em "Gerar link de convite": um POST só. "Gerar novo link" depois: segundo POST e o link mostrado é o novo.
  - "Copiar link": com permissão de área de transferência (`context.grantPermissions(['clipboard-read','clipboard-write'])`) copia o link exato e avisa "Link copiado"; sem permissão avisa "Não foi possível copiar. Selecione e copie o link." e o campo fica selecionável.
  - "Compartilhar" sem `navigator.share`: abre/oferece o link do WhatsApp com o texto e o link codificados (conferir o `href`, sem abrir de verdade).
  - Recarregar a ficha `convidado`: "Convite pendente, expira em dd/mm", **sem** o link, com "Gerar novo link" e "Cancelar convite"; cancelar faz `DELETE …/convite`, avisa e a ficha volta a "Ficha manual".
  - Ficha `convidado` não mostra "Encerrar ficha" nem "Reabrir ficha"; mostra "Editar dados" e "Apagar ficha".
  - Ficha `comConta`: "Vinculado a uma conta do Corner.", sem botões de convite, selo "Com conta"; "Encerrar ficha" pergunta com o texto da confirmação nova (conferir a mensagem do diálogo), faz PATCH `{ status: 'encerrado' }` e o simulador devolve `comConta: false`; reabrir depois **não** traz o vínculo de volta (selo "Ficha manual").
  - Ficha encerrada sem conta: "Gerar link de convite" funciona (reabre a vaga); com 20 ativas a API responde 409 `limite_de_alunos` e a tela mostra a mensagem, ficha continua encerrada (grupo com `toleraRespostaDeErro`).
  - Lista: selos "Convidado", "Com conta", "Ficha manual" e "Encerrada" nos cartões certos.
  - axe sem violações na ficha com convite pendente, com link gerado e com conta; teclado: todos os botões alcançáveis.

- [ ] **Step 2: Rodar e ver falhar** (`npm run build` antes)
  Run: `CI=1 npx playwright test e2e/alunos.spec.ts --workers=2`
  Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar** `ConviteDaFicha`, os selos, a confirmação nova e os textos em `lib/textos.ts` (`conviteCancelado`, `linkCopiado`, `linkNaoCopiado`, etc.). Nada de HTML vindo de dados; o texto do WhatsApp entra por `encodeURIComponent`.

- [ ] **Step 4: Rodar tudo e conferir em 360 px** (captura temporária, apagada depois)
  Run: `npm test && npm run typecheck && npm run lint`, `npm run build`, `CI=1 npx playwright test e2e/alunos.spec.ts e2e/acessibilidade.spec.ts --workers=2`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add app e2e lib
  git commit -m "Cornerman: convite na ficha do aluno (gerar, copiar, compartilhar, cancelar) e selos na lista"
  ```

---

### Task 6: Página do convite e "Meu treinador" no Perfil

**Files:**
- Create: `app/convite/[token]/page.tsx`, `app/convite/[token]/ConviteCliente.tsx`, `app/convite/[token]/convite.module.css`, `components/MeuTreinador.tsx`, `components/MeuTreinador.module.css`, `e2e/convite.spec.ts`
- Modify: `app/(app)/perfil/page.tsx`, `lib/cornerman/cliente.ts`, `lib/textos.ts`

**Interfaces:**
- Consumes: Task 4. Em `cliente.ts`: `consultarConviteNoServidor(token): Promise<RespostaDaApi<{ valido: boolean; treinador?: string; logado: boolean }>>`, `guardarConviteNoServidor(token): Promise<RespostaDaApi<true>>`, `aceitarConviteNoServidor(token): Promise<RespostaDaApi<{ treinador: string }>>`, `meuTreinadorNoServidor(): Promise<RespostaDaApi<{ treinador: { nome: string } | null }>>`, `desvincularNoServidor(): Promise<RespostaDaApi<true>>`.
- Produces: página pública `/convite/<token>` **fora** do grupo `(app)` (sem barra de baixo nem provedores; mesmo visual da tela de login: reusar `@/app/(auth)/login/login.module.css`); `MeuTreinador` (cartão no Perfil, só aparece se há treinador).

- [ ] **Step 1: Escrever os testes de navegador (devem falhar)** em `e2e/convite.spec.ts` (API do convite simulada com `pagina.route`; a sessão real do usuário de teste do `fixtures` vale como "logado"; para "sem sessão" usar `browser.newContext()` sem login)
  - **Sem sessão**, convite válido: "<Primeiro nome> convidou você para treinar junto no Corner", o bloco "O que o treinador poderá ver" e "O que ele nunca verá" com os textos da restrição global, "Você pode se desvincular quando quiser", botões "Entrar" e "Criar conta"; "Entrar" faz `POST …/guardar` e vai para `/login`; "Criar conta" idem e vai para `/onboarding`. Nada do aluno aparece na página.
  - **Convite inválido** (a API responde `valido: false`): "Convite inválido ou expirado." com link "Ir para o Corner"; sem botões de aceitar; mesmo texto para token malformado.
  - **Logado**, convite válido: botão "Aceitar convite"; clicar faz **um** `POST …/aceitar`, mostra "Pronto! Você agora treina com <nome>." e o link "Ir para o Corner" (`/hoje`); duplo clique, um POST só.
  - Erros do aceite: 409 `ja_tem_treinador` mostra a mensagem com link para o Perfil; 400 `proprio_convite` mostra a mensagem; 404 mostra "Convite inválido ou expirado."; sem conexão mostra a mensagem de rede e mantém o botão (grupo com `toleraRespostaDeErro`).
  - **Volta pelo login:** com o cookie `corner_convite` (token falso de 43 caracteres) e logado, abrir `/hoje` termina em `/convite/<token>`; depois de aceitar, `/hoje` abre normalmente (o simulador faz o `Set-Cookie` de remoção; conferir que o cookie some).
  - **Meu treinador:** em `/perfil` com a API simulada devolvendo um treinador: cartão "Meu treinador: Marcos" com o texto "Ele vê o seu nome, foto, nível, estilo, quiz, plano e os treinos dos últimos 30 dias." e o botão "Desvincular"; confirmar (`TEXTOS.confirmar.desvincular(nome)`) faz `DELETE /api/meu-treinador` e o cartão some com o aviso "Você se desvinculou do seu treinador"; cancelar a confirmação não faz nada; sem treinador (`treinador: null`) o cartão **não existe** (nada de "null").
  - axe sem violações na página do convite (válido sem sessão, válido logado, inválido, aceito) e no cartão "Meu treinador"; 360 px sem rolagem horizontal; teclado.

- [ ] **Step 2: Rodar e ver falhar** (`npm run build` antes)
  Run: `CI=1 npx playwright test e2e/convite.spec.ts --workers=2`
  Expected: FAIL.

- [ ] **Step 3: Implementar** a página (componente de servidor com `metadata` e `ConviteCliente` de cliente: consulta `GET /api/convite/<token>` ao abrir; o token vem de `params`, uma Promise), o cartão no Perfil e os textos. A página não usa `getCurrentUser` (é pública).

- [ ] **Step 4: Rodar tudo e conferir em 360 px**
  Run: `npm test && npm run typecheck && npm run lint`, `npm run build`, `CI=1 npx playwright test e2e/convite.spec.ts e2e/alunos.spec.ts e2e/acessibilidade.spec.ts e2e/telas.spec.ts --workers=2`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add app components lib e2e
  git commit -m "Cornerman: página do convite para o aluno e Meu treinador no Perfil"
  ```

---

### Task 7: Fechamento da etapa 3a

**Files:**
- Modify: `docs/plano-cornerman.md`, `docs/testes.md`

- [ ] **Step 1: Documentar** a etapa 3a em `docs/plano-cornerman.md`: o fluxo (treinador gera, aluno abre, entra ou cria conta, volta pelo cookie, aceita), o que o treinador e o aluno veem, as regras (um treinador por aluno, desvincular, reabrir não restaura), a segurança do token, o e-mail desligado, o passo do SQL, os rulings (decisão 19, limite de tentativas) e o que fica para a 3b (quiz guardado, status verde/amarelo/vermelho, aba Treinos, atleta compatível). Atualizar `docs/testes.md`.

- [ ] **Step 2: Verificação completa**
  Run: `npm run check` e `CI=1 npx playwright test --workers=2` (cerca de 25 min; se houver falhas, rodar só as que falharam e dizer o motivo de cada uma).
  Expected: tudo verde, ou cada falha explicada.

- [ ] **Step 3: Fumaça do Supabase real**, se o Renan já rodou os dois SQL; senão, pendente.

- [ ] **Step 4: Revisão independente** da branch desde o fim da etapa 2 (um revisor novo, avisando o Renan), com o Review Focus acima.

- [ ] **Step 5: Commit, push da branch e esperar o CI**
  ```bash
  git add docs
  git commit -m "Cornerman: documentação da etapa 3a"
  git push origin cornerman
  ```
  Esperar o CI da branch ficar verde. **Não** publicar no `main` sem o OK do Renan.

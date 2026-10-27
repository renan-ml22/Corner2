# Cornerman, etapa 1: plano e foto de perfil. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o plano pago Cornerman (R$ 63,90, entre Amador e Profissional) no catálogo, na tela de assinatura e no Stripe de teste, e dar a todos os usuários uma foto de perfil 200×200.

**Architecture:** O Cornerman entra como um nível novo em `lib/assinatura/catalogo.ts` (fonte única); telas, Stripe e regras de acesso já leem dali. A foto é uma entidade nova (`foto`, texto) no padrão de entidades do app: o navegador recorta e reduz a imagem, o repositório guarda no aparelho e sincroniza com a conta em `user_data`, e o servidor valida o formato.

**Tech Stack:** Next 16.4.3 (App Router), React 19, TypeScript estrito, CSS Modules, Vitest, Playwright (Chrome), axe, Stripe SDK 23, Supabase.

**Spec:** `docs/superpowers/specs/2026-10-26-cornerman-design.md` (decisões 2, 6, 13, 14 e a etapa 1).

## Global Constraints

- Antes de escrever código de página ou rota, ler o guia certo em `node_modules/next/dist/docs/` (Next 16 tem mudanças; `AGENTS.md`).
- Preço mensal do Cornerman: **6390** centavos. Anual = mensal × `ANUAL_EM_MESES` (10) = R$ 639,00. Lookup keys: `cornerman_mensal` e `cornerman_anual`.
- Ordem dos níveis: `iniciante`, `amador`, `cornerman`, `profissional`. O Cornerman inclui Iniciante e Amador e **não** inclui nada do Profissional. O Profissional inclui o Cornerman.
- Não mudar preço, nível, lookup key nem acesso de quem já assina Iniciante, Amador ou Profissional.
- Plano do usuário **não** é gravado em `profiles`; a fonte é o Stripe. Não criar `data/planos-assinatura.ts`.
- Foto: JPEG 200×200, qualidade 0,8, texto `data:image/jpeg;base64,…` com no máximo **60 000 caracteres**; texto vazio = sem foto. Foto é do nível **gratuito**.
- TypeScript estrito, CSS Modules, Phosphor (ícones só da lista oficial 2.1.1, conferida por `tests/icones.test.ts`), sem Tailwind e sem biblioteca nova. Textos em português; avisos em `lib/textos.ts`.
- Os arquivos do repositório usam CRLF: editar com a ferramenta de edição, não com `sed` nem heredoc.
- Testes primeiro: ver cada teste falhar pelo motivo certo antes de implementar. Rodar também a suíte inteira (`npm test`) antes de cada commit.
- Mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Trabalho na branch `cornerman` (já existe, com o desenho). **Nada vai para `main` sem o OK explícito do Renan.**

## Review Focus

1. Arquivo escolhido que não é imagem, é enorme, ou o navegador não consegue decodificar (HEIC, GIF quebrado): mensagem clara, nada gravado, a foto anterior continua. (Task 4 e Task 5)
2. Servidor recebe `foto` que não é JPEG em `data:` estrito (SVG, `javascript:`, base64 com lixo, mais de 60 000 caracteres): 400 e nada gravado. (Task 3)
3. Quem já assina Iniciante, Amador ou Profissional continua com o mesmo acesso, preço e estado; um cookie ou cópia local com o nível antigo segue válido. (Task 1)
4. Remover a foto num aparelho vale na conta e nos outros aparelhos (texto vazio, não `null`, porque `user_data.value` não aceita nulo). (Task 3)
5. Nome vazio ou começando por emoji: a inicial do avatar não quebra o emoji ao meio. (Task 4)

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/assinatura/catalogo.ts` (editar) | nível, nome, preço e recurso do Cornerman |
| `lib/foto.ts` (novo) | recorte central, inicial do nome, preparo da foto no navegador |
| `lib/dados/contrato.ts`, `entidades.ts`, `servidor/servico.ts` (editar) | entidade `foto`: validação, sincronização, gravação em `user_data` |
| `hooks/useFoto.ts` (novo) | `[foto, definirFoto]` sobre o repositório |
| `components/Avatar.tsx` + `.module.css` (novos) | círculo com a foto ou a inicial |
| `components/CabecalhoDoPerfil.tsx` + `.module.css` (novos) | foto, nome, e-mail e os botões de trocar e remover |
| `app/(app)/perfil/page.tsx`, `perfil.module.css` (editar) | usa o cabeçalho novo |
| `lib/textos.ts` (editar) | avisos da foto |
| Testes: `tests/assinatura-*.test.ts`, `tests/foto.test.ts`, `tests/contrato.test.ts`, `tests/supabase-servico.test.ts`, `e2e/assinatura.spec.ts`, `e2e/foto-perfil.spec.ts` | veja cada task |

---

### Task 1: Nível Cornerman no catálogo

**Files:**
- Modify: `lib/assinatura/catalogo.ts`
- Test: `tests/assinatura-catalogo.test.ts`, `tests/assinatura-regras.test.ts`, `tests/assinatura-apresentacao.test.ts`, `tests/assinatura-stripe-catalogo.test.ts`, `tests/assinatura-stripe.test.ts`

**Interfaces:**
- Produces: `NIVEIS` = `['iniciante','amador','cornerman','profissional']`; `NOME_DO_NIVEL.cornerman = 'Cornerman'`; `PRECO_MENSAL_CENTAVOS.cornerman = 6390`; `RECURSOS.gestaoDeAlunos = { nome: 'Gestão de alunos: painel com até 20 alunos, fichas, notas e plano sugerido', nivelMinimo: 'cornerman' }`. Tudo o mais (`lookupKey`, `nivelDeLookupKey`, `ordemDoNivel`, `podeUsar`, `recursosNovosDoNivel`, `produtosDesejados`, `precosDesejados`, `configuracaoDoPortal`, `isEstadoAssinatura`) já deriva de `NIVEIS` e não muda.

- [ ] **Step 1: Atualizar e acrescentar os testes (devem falhar)**
  - `assinatura-catalogo.test.ts`: `PRECO_MENSAL_CENTAVOS` igual a `{ iniciante: 3990, amador: 5290, cornerman: 6390, profissional: 6990 }`; ordem dos preços crescente nos quatro níveis; `NIVEIS` igual à lista de quatro; "8 no total" de lookup keys (conter `cornerman_mensal` e `cornerman_anual`); `precoEmCentavos('cornerman','anual')` = 63900 e `formatarPreco(63900)` = `'R$ 639,00'`; novo teste "o Cornerman acrescenta exatamente a gestão de alunos" (`recursosNovosDoNivel` via filtro de `RECURSOS` por `nivelMinimo === 'cornerman'` igual a `['gestaoDeAlunos']`); os planos de treino existentes continuam nos mesmos níveis (o teste "Fundamentos no Iniciante…" não muda).
  - `assinatura-regras.test.ts`: novos testes "Cornerman libera tudo do Iniciante e do Amador e a gestão de alunos, e nada do Profissional" (`podeUsar('checkin')`, `('biblioteca')`, `('gestaoDeAlunos')` verdadeiros; `('planoPreCompeticao')`, `('treinosDeAtletas')`, `('lembrete')`, `('importarDados')` falsos), "Iniciante e Amador não têm a gestão de alunos", "Profissional tem a gestão de alunos" e "`isEstadoAssinatura` aceita `nivel: 'cornerman'` e continua aceitando `'profissional'`".
  - `assinatura-apresentacao.test.ts`: `recursosNovosDoNivel('cornerman')` igual a `[recurso('gestaoDeAlunos').nome]`; `mensalEquivalenteEmCentavos('cornerman')` = `Math.round(63900 / 12)` (5325).
  - `assinatura-stripe-catalogo.test.ts`: nomes dos produtos `['Corner Iniciante','Corner Amador','Corner Cornerman','Corner Profissional']`; 8 preços; `planejar` do zero cria 4 produtos e 8 preços; o portal tem 4 produtos; `descricaoDoNivel('cornerman')` começa com `'Tudo do Amador'` e `descricaoDoNivel('profissional')` começa com `'Tudo do Cornerman'`.
  - `assinatura-stripe.test.ts`: acrescentar, no padrão do caso `profissional` que já existe, um caso com a lookup key `cornerman_mensal` que vira estado com `nivel: 'cornerman'`, `periodo: 'mensal'`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/assinatura-catalogo.test.ts tests/assinatura-regras.test.ts tests/assinatura-apresentacao.test.ts tests/assinatura-stripe-catalogo.test.ts tests/assinatura-stripe.test.ts`
  Expected: FAIL por `cornerman` desconhecido (preços, listas, recurso inexistente).

- [ ] **Step 3: Implementar em `lib/assinatura/catalogo.ts`**
  Acrescentar `'cornerman'` a `NIVEIS` entre `'amador'` e `'profissional'`, o nome, o preço e o recurso `gestaoDeAlunos` (valores acima, comentário do grupo "Cornerman" como os demais). Nenhum outro arquivo de código muda nesta task.

- [ ] **Step 4: Rodar a suíte inteira**
  Run: `npm test`
  Expected: PASS. Qualquer outro teste que fixava "3 planos" ou "6 chaves" deve ser corrigido para o novo número, sem enfraquecer a verificação.

- [ ] **Step 5: Verificar que nada de código ficou com a lista antiga**
  Run: `npm run typecheck`
  Expected: sem erros (os `Record<NivelAssinatura, …>` apontam qualquer lugar esquecido).

- [ ] **Step 6: Commit**
  ```bash
  git add lib/assinatura/catalogo.ts tests/
  git commit -m "Cornerman: novo nível entre Amador e Profissional no catálogo"
  ```

---

### Task 2: Cornerman na tela de assinatura e no Stripe de teste

**Files:**
- Modify: `e2e/assinatura.spec.ts`, `docs/plano-pagamento.md`
- Create: nenhum arquivo de código (a tela e o script já percorrem `NIVEIS`)

**Interfaces:**
- Consumes: `NIVEIS` com o Cornerman (Task 1).

- [ ] **Step 1: Atualizar o teste de navegador (deve falhar)**
  Em `e2e/assinatura.spec.ts`: o laço do pagamento desligado passa a incluir `'Cornerman'`; o teste dos preços mensais acrescenta `plano(pagina, 'Cornerman')` contendo `'R$ 63,90'` e o título "os 4 planos"; o anual acrescenta `'R$ 639,00'` e `'equivale a R$ 53,25 por mês'`; "cada plano lista o que acrescenta e cita o anterior": Cornerman contém `'Tudo do Amador'` e `'Gestão de alunos'`, e o Profissional passa a conter `'Tudo do Cornerman'` (não mais `'Tudo do Amador'`).
  Run (depois de `npm run build`): `CI=1 npx playwright test e2e/assinatura.spec.ts --workers=1`
  Expected: rodar o teste editado **contra o build antigo** (feito antes da Task 1; se não houver, `git stash` das mudanças do catálogo, `npm run build`, rodar, `git stash pop`): FAIL porque o cartão do Cornerman não existe. Depois refazer o build com a Task 1 e ver passar no Step 2.

- [ ] **Step 2: Conferir o layout com 4 cartões**
  `assinatura.module.css` usa `.planos { display: grid; gap }` (uma coluna), então 4 cartões não pedem CSS novo. Abrir `/assinatura` em 360 px de largura e conferir que nada estoura. Rodar `CI=1 npx playwright test e2e/acessibilidade.spec.ts --workers=1`: a tela de assinatura continua sem violações do axe.

- [ ] **Step 3: Documentar**
  Em `docs/plano-pagamento.md`, acrescentar o Cornerman à tabela de planos e preços (R$ 63,90 / R$ 639,00) e a frase de que ele inclui Iniciante e Amador e o Profissional inclui o Cornerman.

- [ ] **Step 4: Sincronizar o Stripe de teste (precisa do OK do Renan na hora)**
  Perguntar ao Renan antes. Rodar primeiro `npm run stripe:sincronizar -- --simular` e mostrar o plano de ação (esperado: criar o produto Corner Cornerman, os preços `cornerman_mensal` e `cornerman_anual`, atualizar a descrição do Profissional para "Tudo do Cornerman…", atualizar o Portal). Só então `npm run stripe:sincronizar`. Nunca imprimir a chave.
  Depois: `npm run stripe:fumaca` (pagamento simulado de ponta a ponta no modo de teste) deve terminar sem falhas.

- [ ] **Step 5: Commit**
  ```bash
  git add e2e/assinatura.spec.ts docs/plano-pagamento.md
  git commit -m "Cornerman: plano na tela de assinatura e documentação de preços"
  ```

---

### Task 3: Entidade `foto` (validação, sincronização, servidor)

**Files:**
- Modify: `lib/dados/contrato.ts`, `lib/dados/entidades.ts`, `lib/dados/servidor/servico.ts`, `scripts/supabase-fumaca.ts`
- Test: `tests/contrato.test.ts`, `tests/supabase-servico.test.ts`, `tests/repositorio-local.test.ts`, `tests/backup.test.ts`, `tests/fusao.test.ts`

**Interfaces:**
- Produces:
  - `export const TAMANHO_MAX_DA_FOTO = 60_000` e `export const isFoto: (v: unknown) => v is string` em `contrato.ts` (vale `''` ou texto que casa com `^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$` e tem no máximo 60 000 caracteres).
  - `DadosDoApp.foto: string`; `ENTIDADES.foto = { inicial: '', validar: isFoto }` (sem `limpar` e **sem** `erroBackup`: a foto não entra no arquivo de backup); `'foto'` em `ENTIDADES_SINCRONIZADAS`; `'foto'` em `GENERICAS` do servidor (vai para `user_data`).

- [ ] **Step 1: Escrever os testes (devem falhar)**
  - `contrato.test.ts` (`isFoto`): aceita `''`; aceita um JPEG válido curto (`'data:image/jpeg;base64,/9j/4AAQSkZJRg=='`); recusa `'data:image/png;base64,AAAA'`, `'data:image/svg+xml;base64,PHN2Zz4='`, `'javascript:alert(1)'`, `'data:image/jpeg;base64,AA AA'`, `'data:image/jpeg;base64,'` (vazio), `null`, `42`; recusa texto válido com 60 001 caracteres e aceita com exatamente 60 000.
  - `supabase-servico.test.ts` (banco de mentira que o arquivo já usa): `salvarEntidades` com `{ foto: <jpeg válido> }` chama `salvarDado(usuario, 'foto', <o mesmo texto>)`; com `{ foto: '' }` grava `''` (nunca `null`); com SVG, com 60 001 caracteres e com `{ foto: null }` lança `ErroDados` `dado_invalido` (400) e **não grava nada**, nem as outras entidades do mesmo pedido; `carregarDados` devolve `foto` quando há linha `foto` em `user_data`, e não devolve a chave quando não há; o teste que lista `ENTIDADES_SINCRONIZADAS` passa a incluir `'foto'`.
  - `repositorio-local.test.ts`, `backup.test.ts`, `fusao.test.ts`: ajustar o que fixa a lista de entidades (o objeto `legado` ganha `foto: ''`; a lista do backup **continua igual**, sem `foto`; `fundir('foto', 'a', 'b')` devolve o da conta).

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/contrato.test.ts tests/supabase-servico.test.ts tests/repositorio-local.test.ts tests/backup.test.ts tests/fusao.test.ts`
  Expected: FAIL (`isFoto` não existe; `foto` desconhecida).

- [ ] **Step 3: Implementar**
  `isFoto` e a constante em `contrato.ts`; entidade e tipo em `entidades.ts` (a regex só tem classes de caracteres simples, sem repetição aninhada: linear no tamanho); `'foto'` em `GENERICAS`. `scripts/supabase-fumaca.ts`: incluir `foto` com um JPEG mínimo válido no pacote de teste e conferir a ida e volta (e a remoção com `''`).

- [ ] **Step 4: Rodar a suíte inteira e o tipo**
  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Fumaça no Supabase de verdade (só o usuário de teste)**
  Run: `npm run supabase:fumaca`
  Expected: termina sem falhas, incluindo a ida e volta da foto. Não imprimir chaves.

- [ ] **Step 6: Commit**
  ```bash
  git add lib/dados scripts/supabase-fumaca.ts tests/
  git commit -m "Foto de perfil: entidade nova, validada no servidor e sincronizada com a conta"
  ```

---

### Task 4: Regras puras da foto (`lib/foto.ts`)

**Files:**
- Create: `lib/foto.ts`, `tests/foto.test.ts`

**Interfaces:**
- Consumes: `isFoto`, `TAMANHO_MAX_DA_FOTO` (Task 3).
- Produces (todas em `lib/foto.ts`):
  - `export const LADO_DA_FOTO = 200`, `QUALIDADE_DA_FOTO = 0.8`, `TAMANHO_MAX_DO_ARQUIVO = 15_000_000` (bytes; recusa antes de decodificar).
  - `export function recorteCentral(largura: number, altura: number): { x: number; y: number; lado: number }` — maior quadrado centralizado, em inteiros; `lado` 0 se alguma medida não for um número positivo.
  - `export function inicialDoNome(nome: string): string` — primeira letra (por caractere inteiro, não por unidade UTF-16) em maiúscula; `'?'` se o nome for vazio ou só espaços.
  - `export type ResultadoFoto = { ok: true; foto: string } | { ok: false; erro: 'nao_e_imagem' | 'muito_grande' | 'ilegivel' }`
  - `export async function prepararFoto(arquivo: File): Promise<ResultadoFoto>` — só no navegador: recusa o que não é `image/*` (`nao_e_imagem`) e o que passa de `TAMANHO_MAX_DO_ARQUIVO` (`muito_grande`) **antes** de decodificar; decodifica com `createImageBitmap`, recorta com `recorteCentral`, desenha em canvas 200×200 e exporta `toDataURL('image/jpeg', 0.8)`; qualquer falha de decodificação ou resultado que não passe em `isFoto` vira `ilegivel`.

- [ ] **Step 1: Escrever os testes (devem falhar)** em `tests/foto.test.ts`
  - `recorteCentral(400, 200)` = `{ x: 100, y: 0, lado: 200 }`; `(200, 400)` = `{ x: 0, y: 100, lado: 200 }`; `(300, 300)` = `{ x: 0, y: 0, lado: 300 }`; `(401, 200)` = `{ x: 100, y: 0, lado: 200 }` (inteiros); `(0, 100)`, `(NaN, 100)`, `(-5, 5)` têm `lado` 0.
  - `inicialDoNome`: `'renan'` → `'R'`; `'  ana'` → `'A'`; `''` e `'   '` → `'?'`; `'🥊 Beto'` → `'🥊'` (inteiro, sem metade); `'éder'` → `'É'`.
  - `prepararFoto(new File(['x'], 'a.txt', { type: 'text/plain' }))` → `{ ok: false, erro: 'nao_e_imagem' }`; um `File` de tipo `image/png` com `size` forçado para `TAMANHO_MAX_DO_ARQUIVO + 1` (via `Object.defineProperty`) → `muito_grande`. (A decodificação de verdade é coberta no navegador, Task 5.)

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/foto.test.ts`
  Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `lib/foto.ts`** com as assinaturas acima. `prepararFoto` não usa `Image`/`FileReader` (usa `createImageBitmap`, que respeita a orientação EXIF) e fecha o bitmap (`close()`) ao terminar.

- [ ] **Step 4: Rodar a suíte inteira**
  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/foto.ts tests/foto.test.ts
  git commit -m "Foto de perfil: recorte, inicial do nome e preparo da imagem"
  ```

---

### Task 5: Foto no perfil (hook, avatar, cabeçalho, avisos)

**Files:**
- Create: `hooks/useFoto.ts`, `components/Avatar.tsx`, `components/Avatar.module.css`, `components/CabecalhoDoPerfil.tsx`, `components/CabecalhoDoPerfil.module.css`, `e2e/foto-perfil.spec.ts`
- Modify: `app/(app)/perfil/page.tsx`, `app/(app)/perfil/perfil.module.css` (remover `.avatar` e `.profileHeader` que passam para os componentes novos), `lib/textos.ts`

**Interfaces:**
- Consumes: `useEntidade`, `useRepositorio`, `useToast`, `prepararFoto`, `inicialDoNome` (Tasks 3 e 4).
- Produces:
  - `export function useFoto(): [string, (nova: string) => void]` em `hooks/useFoto.ts` (`''` = sem foto).
  - `export default function Avatar({ nome, foto, tamanhoRem = 3.7 }: { nome: string; foto: string; tamanhoRem?: number })`: com foto, `<img alt="Sua foto de perfil" width/height>` redonda com `object-fit: cover`; sem foto, o círculo em gradiente atual com `inicialDoNome(nome)` e `aria-hidden`.
  - `export default function CabecalhoDoPerfil({ nome, email }: { nome: string; email: string })`: o cartão atual do perfil com o `Avatar`, o nome, o e-mail e um botão "Adicionar foto" / "Trocar foto" (um `<label>` com `<input type="file" accept="image/*" class="sr-only">`) e, com foto, um botão "Remover foto".
  - Em `TEXTOS.aviso`: `fotoSalva`, `fotoRemovida`, `fotoNaoEImagem` ("Escolha uma imagem."), `fotoGrande` ("Essa imagem é grande demais. Escolha uma de até 15 MB."), `fotoIlegivel` ("Não foi possível ler essa imagem. Tente outra, de preferência JPG ou PNG.").

- [ ] **Step 1: Escrever o teste de navegador (deve falhar)** em `e2e/foto-perfil.spec.ts` (usa `./fixtures`; ler `e2e/constantes.ts` para a chave do `localStorage` da entidade)
  - Sem foto, `/perfil` mostra a inicial do nome e o botão "Adicionar foto".
  - Escolher um PNG de 400×200 (gerado no próprio teste, decodificável) faz aparecer a imagem "Sua foto de perfil" com `naturalWidth` e `naturalHeight` iguais a 200; o valor guardado começa com `data:image/jpeg;base64,` e tem no máximo 60 000 caracteres; o botão vira "Trocar foto" e aparece "Remover foto".
  - Recarregar a página mantém a foto.
  - "Remover foto" volta à inicial e o valor guardado fica `''` (e não é apagado, para a remoção sincronizar).
  - Arquivo de texto (`text/plain`): aviso `fotoNaoEImagem`, nada guardado, a foto anterior (se houver) continua.
  - Arquivo `image/png` com conteúdo inválido (bytes aleatórios): aviso `fotoIlegivel`, nada guardado.
  - axe sem violações em `/perfil` com e sem foto; o campo de arquivo tem nome acessível e funciona pelo teclado.
  Run: `CI=1 npx playwright test e2e/foto-perfil.spec.ts --workers=1` (com build refeito)
  Expected: FAIL (não há botão nem imagem).

- [ ] **Step 2: Implementar** `useFoto`, `Avatar`, `CabecalhoDoPerfil` e os textos; o cabeçalho é um componente de cliente (`'use client'`) recebendo `nome` e `email` da página do servidor, que continua lendo `getCurrentUser()`. Ao escolher o arquivo: `prepararFoto`; em sucesso grava com `definirFoto` e avisa `fotoSalva`; em erro avisa o texto do erro e não grava. Limpar o `value` do input depois (permite escolher o mesmo arquivo de novo).

- [ ] **Step 3: Rodar o teste de navegador e a suíte inteira**
  Run: `npm run build` e depois `CI=1 npx playwright test e2e/foto-perfil.spec.ts e2e/acessibilidade.spec.ts e2e/telas.spec.ts --workers=1`, e `npm test`
  Expected: PASS.

- [ ] **Step 4: Conferir à mão em 360 px** (navegador real, com o servidor local): enviar uma foto, recarregar, remover. Se algo não for conferido, dizer.

- [ ] **Step 5: Commit**
  ```bash
  git add hooks/useFoto.ts components/Avatar.* components/CabecalhoDoPerfil.* "app/(app)/perfil" lib/textos.ts e2e/foto-perfil.spec.ts
  git commit -m "Foto de perfil: escolher, trocar e remover no perfil"
  ```

---

### Task 6: Fechamento da etapa

**Files:**
- Create: `docs/plano-cornerman.md`
- Modify: `docs/superpowers/specs/2026-10-26-cornerman-design.md` (marcar a etapa 1 como concluída, se aplicável)

- [ ] **Step 1: Documentar** em `docs/plano-cornerman.md`: o que a etapa 1 entregou (nível Cornerman, foto), onde a foto é guardada (entidade `foto` em `user_data`, texto vazio = sem foto, limite de 60 000 caracteres), como o Stripe de teste foi sincronizado, e o que falta (etapas 2 a 4).

- [ ] **Step 2: Verificação completa**
  Run: `npm run check` (typecheck, lint, testes, build) e `CI=1 npx playwright test --workers=1`
  Expected: tudo verde. Se algo falhar ou for pulado, dizer qual e por quê.

- [ ] **Step 3: Revisão independente** da branch inteira (um revisor novo, avisando o Renan) antes de entregar.

- [ ] **Step 4: Commit**
  ```bash
  git add docs
  git commit -m "Cornerman: documentação da etapa 1"
  ```

- [ ] **Step 5: Publicação (só com o OK do Renan)**
  Abrir a branch, esperar o CI (`verificar`) ficar verde e perguntar. Recomendação a levar ao Renan: publicar a etapa 1 junto com a etapa 2, porque a tela de assinatura passa a anunciar "Gestão de alunos" e a página dela só chega na etapa 2 (o pagamento está em modo de teste, então ninguém é cobrado). Fluxo, se aprovado: `git push origin <branch>:main`, apagar a branch, confirmar o CI no `main` e o deploy na Vercel.

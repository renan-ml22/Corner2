# Corner — Plano de melhorias

Base: `docs/relatorio.html` (seções 07 e 08). **Fora do escopo por enquanto:** banco de dados, conta com sincronização, notificações push e cadastro de usuários. O plano prepara o terreno para eles (fase 4), mas não os implementa.

Estado de partida (verificado em 13/10/2026): 37 arquivos pendentes no git, nenhum teste automatizado, sem `.github/`, scripts do `package.json` só com `dev/build/start/lint`. `CornerProvider.tsx` 381 linhas, `AppSheets.tsx` 355, `globals.css` 1196.

Regras de trabalho (memória do projeto): TDD nas regras puras, subagentes em tarefas grandes (avisando antes) e auditoria antes de cada entrega importante.

---

## Estado (15/10/2026)

| Fase | Situação |
|---|---|
| 0 Auditar, dividir em commits e publicar | Concluída |
| 1 Vitest nas regras puras | Concluída (1.159 testes de unidade) |
| 2 Atualizar dependências | Concluída (0 vulnerabilidades em produção; exceção do lint em `docs/excecoes-de-seguranca.md`) |
| 3 CI e auditoria padronizada | Concluída (CI com tipos, lint, testes, build, navegador e auditoria; `main` protegida) |
| 4 Camada de dados única | Concluída (`docs/camada-de-dados.md`) |
| 5 Dividir provider, painéis e CSS | Concluída |
| 6 Teste em celular real | **Pendente: depende de você** (roteiro em `docs/teste-celular.md`) |
| 7 Acessibilidade e textos | Concluída (axe, teclado, contraste, títulos, `lib/textos.ts`) |
| Estilos inline | Concluída: só restam os dinâmicos |
| Conta com banco de dados | Adiada por decisão: provedor ainda não escolhido |

---

## Visão geral

| Fase | Objetivo | Esforço | Depende de |
|---|---|---|---|
| 0 | Publicar a segunda fase com segurança | Baixo | — |
| 1 | Rede de segurança: Vitest nas regras puras | Médio (~1 dia) | 0 |
| 2 | Atualizar dependências vulneráveis | Baixo a médio | 1 |
| 3 | CI no GitHub + script de auditoria | Baixo a médio | 1 |
| 4 | Camada de dados única + contrato + versão do esquema | Médio a alto | 1 |
| 5 | Dividir provider, painéis e CSS | Médio | 4 |
| 6 | Teste em celular real | Baixo | 0 (repetir a cada entrega) |
| 7 | Acessibilidade e textos | Baixo | 5 |

Fases 2, 3 e 6 podem andar em paralelo depois da 1.

---

## Fase 0 — Auditar, dividir em commits e publicar a segunda fase

**Por quê:** 37 arquivos soltos são difíceis de revisar e de desfazer; a segunda fase nunca foi à Vercel.

1. Rodar a auditoria manual: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm audit`. Registrar o resultado.
2. Conferir as variáveis de ambiente da Vercel contra `.env.local` (nomes apenas, sem valores): usuário, e-mail, hash da senha, chave de sessão.
3. Separar em commits por assunto, na ordem:
   - cronômetro de rounds (`hooks/useCronometro.ts`, `lib/som.ts`, `app/(app)/treino/`)
   - biblioteca técnica (`data/tecnicas.ts`, `app/(app)/tecnicas/`)
   - carga, check-in e alertas (`lib/sessao.ts`, `CheckinCard`, ajustes em `lib/treinos.ts`)
   - saúde (`lib/saude.ts`, `GraficoPeso`, `app/(app)/saude/`)
   - perfil, reagendamento, backup e lembrete (`PreferenciasCard`, `lib/notificar.ts`, `SairButton`)
   - modo offline e ícones (`public/sw.js`, `offline.html`, `RegistrarSW`, ícones, manifesto)
   - documentação (`docs/`)
   - `AGENTS.md`/`CLAUDE.md` gerados pelo `next dev`, se houver diff
4. `git push` e conferir o deploy. Fazer login real em produção e abrir cada tela.
5. **Ação sua:** trocar a senha do usuário de teste (foi exposta na conversa). Gerar novo hash e nova chave de sessão, atualizar `.env.local` e a Vercel, e fazer novo deploy.

**Pronto quando:** build verde, deploy no ar, login funciona em produção, árvore git limpa.

> O envio ao GitHub e a troca de senha precisam da sua confirmação; eu preparo os commits e aviso antes de dar push.

---

## Fase 1 — Vitest nas regras puras (TDD)

**Por quê:** as 48 verificações de navegador eram descartáveis. Sem teste salvo, qualquer refactor das fases 4 e 5 é às cegas.

**Passos**
1. Instalar `vitest`; configurar alias `@/` e ambiente `node`. Scripts: `test`, `test:watch`, `typecheck` (`tsc --noEmit`).
2. Escrever testes de caracterização, um módulo por vez, congelando o comportamento atual:
   - `lib/datas.ts` — semana, virada de mês/ano, fuso
   - `lib/treinos.ts` — sequência em semanas na meta, status das sessões (feita/hoje/a fazer/não feita), treino em outro dia valendo pela sessão do mesmo tipo
   - `lib/saude.ts` — carga (esforço × minutos, 7 dias contra a média anterior), prontidão, alertas (cabeça, lesões, sparrings seguidos, carga, meta, perda rápida de peso)
   - `lib/sessao.ts` — ajuste sugerido do treino pelo check-in
   - `lib/tipos.ts` — validadores: aceitam o válido, rejeitam lixo e dado corrompido
   - `data/planos.ts` — os 4 planos: duração, fases, semana de polimento, checklist presente em toda sessão
   - `lib/users.ts` — hash e comparação de senha (e-mail inexistente = senha errada)
3. Cada bug encontrado vira teste que falha primeiro, depois a correção.
4. **Opcional (decidir depois):** Playwright com 5 a 8 fluxos de fumaça (login, registrar treino, cronômetro, backup válido/inválido, offline). Só se a fase 3 mostrar que vale o tempo de CI.

**Pronto quando:** `npm test` verde; cobertura das regras de `lib/` e `data/`; os cenários do relatório (página 9) estão representados.

**Subagentes:** bom ponto para paralelizar (um por módulo), avisando antes.

---

## Fase 2 — Atualizar dependências

**Por quê:** o relatório cita 3 achados (Next crítico via `next/og`, sharp e source-map-js, altos).

1. `npm audit` para ver o estado atual. O relatório é de 06/10 e a situação pode ter mudado.
2. Ler `node_modules/next/dist/docs/` antes de mexer no Next (instrução do `AGENTS.md`: esta versão tem mudanças de API).
3. Atualizar **só o Next e dependentes dele**, em um commit separado. Rodar testes, lint, build e um smoke manual de login e rotas.
4. Tratar sharp e source-map-js (normalmente transitivas; ver se resolvem com a atualização ou com `overrides`).
5. Se algum achado não tiver correção, documentar o motivo e por que o app não é afetado.

**Pronto quando:** `npm audit` sem críticos/altos, ou cada exceção justificada por escrito.

---

## Fase 3 — CI e auditoria padronizada

**Por quê:** hoje o login quebrou na Vercel por variáveis ausentes e só o usuário percebeu.

1. Script `check` no `package.json`: `typecheck` + `lint` + `test` + `build`.
2. Script `scripts/verificar-env.mjs`: confere se as variáveis obrigatórias existem (só nomes, sem imprimir valores). Roda no `check` e avisa quando faltar algo.
3. `.github/workflows/ci.yml`: em push e PR, `npm ci` → `check` → `npm audit --audit-level=high`. Variáveis de teste fictícias no workflow.
4. Proteger a `main` no GitHub (exigir CI verde). **Ação sua**, nas configurações do repositório.

**Pronto quando:** um PR de teste com erro proposital é bloqueado pelo CI.

---

## Fase 4 — Camada de dados única, contrato e versão do esquema

**Por quê:** é a prioridade alta da página 11. Hoje o `CornerProvider` conhece as chaves do localStorage; quando o banco chegar, quase toda tela seria tocada.

**Desenho proposto**
- `lib/dados/contrato.ts`: tipos e validadores de cada entidade (treino, plano, config, checklist, check-in, lesão, peso, ajuste, reagendamento) **numa fonte só**. Hoje estão divididos entre `lib/tipos.ts` e `CornerProvider.tsx` (linha 97 em diante). Usados por armazenamento, backup e, no futuro, API.
- `lib/dados/repositorio.ts`: interface `Repositorio` (ler, gravar e assinar mudanças, por entidade e usuário), **compatível com `useSyncExternalStore`**, para a UI continuar síncrona.
- `lib/dados/repositorio-local.ts`: implementação em localStorage (o código atual do `useStorage` migra para cá).
- `lib/dados/esquema.ts`: versão do esquema gravada junto dos dados e lista de migrações (v1 → v2…). O backup passa a carregar a versão e a importação migra arquivos antigos.
- `hooks/useStorage.ts` vira um hook fino sobre o repositório; telas e provider deixam de citar chaves ou `localStorage`.

**Passos (TDD)**
1. Testes do contrato (reaproveitam os de `tipos.ts` da fase 1).
2. Testes de migração: dado v1 sem versão → v1 marcado → v2; dado corrompido não derruba o app.
3. Extrair o repositório local sem mudar comportamento; todos os testes da fase 1 continuam verdes.
4. Trocar os usos diretos (`useStorage`, `localStorage` em `CornerProvider.tsx` linhas 352-353 do lembrete) pelo repositório.
5. Backup: exportar com versão; importar valida pelo contrato e migra.
6. Teste de contrato do repositório (mesmo conjunto de testes rodará depois contra a implementação de banco).

**Decisão a confirmar:** manter a interface **síncrona com cache** (recomendado: a UI não muda, e a implementação de banco depois hidrata o cache e grava em segundo plano) ou torná-la assíncrona agora (mais honesta com a rede, mas toca todas as telas e adia o ganho).

**Pronto quando:** nenhum arquivo em `app/` ou `components/` cita `localStorage` ou chave de armazenamento; migrações testadas; backup antigo ainda importa.

---

## Fase 5 — Dividir provider, painéis e CSS

**Por quê:** leitura mais simples, menos re-renderização, estilos mais seguros. Feita **depois** dos testes e da camada de dados, que protegem o refactor.

1. **`CornerProvider`** (381 linhas, 9 blocos de dados): dividir em contextos por assunto — histórico/registro, saúde (check-in, lesões, peso), plano/reagendamento, preferências/lembrete e painéis. Manter um hook de compatibilidade durante a transição para migrar tela por tela. Um commit por contexto.
2. **`AppSheets`** (355 linhas, 84 estilos inline): um arquivo por painel em `components/sheets/`, com CSS Module. Estilos inline repetidos viram classes.
3. **`globals.css`** (1196 linhas): manter só tokens, reset e utilitários globais; mover o resto para CSS Modules junto do componente, **uma tela por commit**. Remover regras sem uso só com conferência visual da tela.
4. A cada passo: `npm run check` e smoke manual da tela afetada.

**Pronto quando:** nenhum arquivo acima de ~250 linhas sem motivo; `globals.css` bem menor; sem regressão nos testes.

**Subagentes:** bom candidato (um por painel/tela), avisando antes.

---

## Fase 6 — Teste em celular real

Repetir a cada entrega que mexa em cronômetro, offline ou instalação. Roteiro:

- [ ] Instalar o app (Android: Chrome; iPhone: Safari → Adicionar à Tela de Início). Ícone e nome corretos.
- [ ] Cronômetro: sino de início, matraca aos 10 s, bips 3-2-1, sino de fim. Volume e modo silencioso do iPhone.
- [ ] Vibração (Android; **não existe no iPhone**, conferir que a ausência não quebra nada).
- [ ] Tela permanece acesa durante o round; tempo correto após bloquear e voltar.
- [ ] Modo avião: Hoje e cronômetro abrem; tela nunca visitada mostra a página offline.
- [ ] Sair da conta apaga as cópias offline.
- [ ] Lembrete diário dispara com o app aberto.
- [ ] Campos sem zoom no iPhone, área segura com entalhe, teclado não cobre botões.

Ao final: registrar os achados em `docs/` e abrir correções como tarefas.

---

## Fase 7 — Acessibilidade e textos (baixa prioridade)

1. Checar contraste (tema escuro, vermelho/azul) e navegação completa por teclado, com foco visível em painéis e cronômetro.
2. Revisar rótulos e leitura por leitor de tela (gráficos já têm tabela alternativa).
3. Centralizar textos em um módulo (`lib/textos.ts` ou similar), sem trocar de idioma agora.

---

## Riscos e cuidados

- **Refactor sem teste:** por isso a fase 1 vem antes de 4 e 5. Não pular.
- **Next com API diferente:** consultar `node_modules/next/dist/docs/` antes de atualizar ou mexer em rotas, proxy e cookies.
- **Migração de dados do usuário:** qualquer mudança de formato precisa de migração testada; nunca apagar dados antigos silenciosamente.
- **Variáveis de ambiente:** nunca imprimir valores; verificar só os nomes.
- **Push e deploy:** só com sua confirmação.

## Ordem de execução sugerida

0 → 1 → (2 ∥ 3 ∥ 6) → 4 → 5 → 7. Depois disso o app está pronto para a conta com banco de dados, que entra num plano próprio (provedor ainda não escolhido: Supabase ou Neon).

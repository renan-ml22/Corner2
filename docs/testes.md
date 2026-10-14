# Testes

| O quê | Comando | Onde |
|---|---|---|
| Regras e dados (unidade) | `npm test` | `tests/` (Vitest, rápido, sem navegador) |
| Navegador de verdade | `npm run e2e` | `e2e/` (Playwright com o Chrome instalado) |
| Tudo que o CI roda, menos o navegador | `npm run check` | tipos, lint, testes e build |
| Variáveis de ambiente | `npm run verificar-env` | confere nomes e formato (nunca imprime valores) |

## Testes de navegador

- Sobem o app em modo produção (`next start`, porta 3100) com um **usuário só de teste**, definido em `e2e/constantes.ts`. Não usam o `.env.local` nem a Vercel.
- Cada teste abre um navegador limpo, entra e vigia o console: qualquer erro de página ou aviso de hidratação reprova o teste.
- Domínios externos (como o CSS de ícones do unpkg) respondem vazio, para os testes serem rápidos e não dependerem de internet.
- Rodam com 2 navegadores por vez (`workers` em `playwright.config.ts`). Com muitos Chromes ao mesmo tempo as páginas ficam lentas demais e os testes estouram o tempo.
- Localmente o `npm run e2e` faz o build antes. No CI o build já foi feito no passo anterior.
- Se um teste falhar no CI, o relatório (com o trace) fica como artefato da execução, por 7 dias. Localmente: `npx playwright show-report`.

## Quando escrever cada tipo

- Regra de cálculo, validador, migração: teste de unidade em `tests/` (primeiro o teste, depois o código).
- Fluxo que atravessa tela, armazenamento e navegador (login, backup, abas): teste em `e2e/`.

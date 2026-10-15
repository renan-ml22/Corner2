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

## Acessibilidade

- `e2e/acessibilidade.spec.ts`: auditoria automática com o **axe-core** (regras WCAG 2.0/2.1 A e AA) em todas as telas, nos estados vazios, nos painéis (cada passo) e no login. Também confere que cada tela tem um **título próprio**.
- `e2e/teclado.spec.ts`: navegação só pelo teclado. Painéis recebem o foco ao abrir, fecham com **Esc**, mantêm **Tab** dentro deles, deixam o resto da página inerte e devolvem o foco a quem os abriu; abas e grupos de rádio respondem às **setas**.
- O axe acha o que é mecânico (contraste, nomes de botões, rótulos, papéis). Ele **não substitui** testar com leitor de tela (TalkBack no Android, VoiceOver no iPhone) de vez em quando.
- Cores: o cinza de texto secundário (`--color-neutral-400`) e o vermelho de texto pequeno (`--color-red-texto`) foram escolhidos para dar 4,5:1 ou mais sobre os cartões. Ao criar uma cor nova para texto, rode a auditoria.

## Textos

Avisos rápidos, confirmações e mensagens de validação ficam em `lib/textos.ts`. Um teste (`tests/textos-uso.test.ts`) barra literais soltos em `showToast`, `window.confirm` e `setErro…`.

## Estilos

- Estilo de um componente ou tela fica num **CSS Module** ao lado dele; o que é compartilhado fica em `app/estilos/` (`base`, `layout`, `componentes`, `utilidades`).
- `utilidades.css` tem espaçamentos avulsos (`mt-14`, `mb-12`, `espaco-12`). **Não combine uma utilitária com uma classe de módulo que já define a mesma propriedade:** o módulo vence (ele carrega depois) e a utilitária é ignorada em silêncio. Nesse caso, crie a classe no próprio módulo. A comparação de capturas de tela pega esse erro; os testes de unidade não.
- Evite `style={{ ... }}` fixo. Só use para valores calculados (largura de barra em %, tamanho da logo).
- Num par `-webkit-x` + `x`, escreva o prefixado **primeiro** (o minificador do Next descarta o padrão se vier antes). Um teste confere.

## Quando escrever cada tipo

- Regra de cálculo, validador, migração: teste de unidade em `tests/` (primeiro o teste, depois o código).
- Fluxo que atravessa tela, armazenamento e navegador (login, backup, abas): teste em `e2e/`.

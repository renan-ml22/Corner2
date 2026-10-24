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

## Assinaturas e pagamento

- `npm run stripe:sincronizar`: cria ou conserta produtos, preços e Portal no Stripe de teste (idempotente). Com `-- --simular`, só mostra o que faria.
- `npm run stripe:fumaca`: exercita o código das rotas contra o Stripe de teste de verdade e limpa o que criou.
- Testes de unidade (`tests/assinatura-*.test.ts`): catálogo, regras de acesso, conversão do Stripe, serviço (com um Stripe falso), cookie de estado, validação do pedido e alertas por plano.
- Testes de navegador (`e2e/assinatura*.spec.ts` e `e2e/bloqueio.spec.ts`): as rotas e as telas com a API de assinatura **simulada**. O servidor de teste sobe **sem** chave do Stripe, com as variáveis vazias de propósito (o `next start` leria o `.env.local` da sua máquina). Nenhum teste automático fala com o Stripe.
- `tests/sem-segredos.test.ts` falha se qualquer chave do Stripe aparecer em arquivo versionado.
- Teste manual com a página de pagamento do Stripe: roteiro em `docs/plano-pagamento.md`.

## Conta na nuvem (Supabase)

- Testes de unidade: `tests/supabase-*.test.ts` (mapeamento entre dados do app e linhas, serviço com banco de mentira, adaptador com cliente de mentira, leitura do corpo e erros), `tests/fusao.test.ts`, `tests/repositorio-sincronizado.test.ts` (aparelho offline, falhas, gravar durante um envio, primeira vez neste aparelho) e `tests/remoto-http.test.ts`.
- Testes de navegador: `e2e/api-dados.spec.ts`. O servidor de teste sobe **sem** as variáveis do Supabase (vazias de propósito, pelo mesmo motivo do Stripe), então a conta na nuvem fica desligada e nenhum teste automático fala com o banco.
- `npm run supabase:fumaca`: exercita o código da rota contra o Supabase **de verdade** com dois usuários de mentira e limpa o que criou. Precisa do `supabase/schema.sql` já rodado e das variáveis no `.env.local`.
- `tests/sem-segredos.test.ts` também falha se a chave secreta do Supabase aparecer em arquivo versionado ou for lida por um arquivo do navegador.
- Passo a passo para ligar e testar à mão: [`plano-supabase.md`](plano-supabase.md).
- **Métricas (PostHog):** `tests/analytics.test.ts`, `tests/analytics-uso.test.ts`, `e2e/analytics.spec.ts` e `npm run posthog:verificar` (chave de mentira e rede interceptada). Detalhes em [`plano-posthog.md`](plano-posthog.md).
- **Onboarding e contas:** `tests/onboarding.test.ts`, `tests/contas.test.ts`, `tests/cadastro.test.ts`, `e2e/onboarding.spec.ts`; e `npm run supabase:fumaca` também cria uma conta de verdade, confere e apaga. Detalhes em [`plano-onboarding.md`](plano-onboarding.md).

## Quando escrever cada tipo

- Regra de cálculo, validador, migração: teste de unidade em `tests/` (primeiro o teste, depois o código).
- Fluxo que atravessa tela, armazenamento e navegador (login, backup, abas): teste em `e2e/`.

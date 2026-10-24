# Corner — Métricas de produto (PostHog)

Estado: **código pronto e verificado** (testes de unidade, testes de navegador e uma verificação com a rede interceptada, que lê o que sairia do navegador). Falta a chave do PostHog no `.env.local` e na Vercel. **Sem a chave, nada é carregado, enviado nem guardado:** o app funciona igual.

## Eventos

| Evento | Quando | Propriedades | Onde no código |
|---|---|---|---|
| `onboarding_started` | a pessoa abre `/onboarding` | nenhuma | `app/onboarding/CadastroForm.tsx` |
| `onboarding_completed` | clica em "Começar agora" no último passo | `nivel`, `dias_por_semana`, `plano_escolhido` | `app/onboarding/(passos)/plano/PlanoCliente.tsx` |
| `workout_registered` | salva um treino | `tipo`, `rounds`, `rpe`, `duracao_segundos` | `hooks/useHistorico.ts` |
| `plan_selected` | escolhe um plano (em qualquer tela) | `plano_id`, `nivel` (do plano) | `hooks/usePlano.ts` |
| `sheet_opened` | abre um painel (fechado → aberto) | `sheet_name`: `registro_treino`, `alertas`, `escolher_plano`, `perfil_atleta` ou `exercicio` (painel de um exercício; não diz qual) | `components/PainelProvider.tsx` |
| `tab_changed` | troca de aba na barra de baixo (clicar na aba atual não conta) | `tab_name`: `hoje`, `plano`, `progresso` ou `perfil` | `components/BottomNav.tsx` |

Além deles, o `$identify`: depois do login, o app liga as métricas à pessoa **pelo id** (o uuid da conta). Ao sair da conta, o PostHog esquece a pessoa no aparelho (`reset`).

Os três passos do registro de treino (tipo, detalhes, concluído) contam como **um** painel.

## Privacidade: este app guarda dados de saúde

Lesões, pancadas na cabeça, peso. Por isso as métricas são uma **lista fechada**, e não um "rastreia tudo":

- **Cada evento tem propriedades fixas e validadas** (`lib/analytics.ts`). Texto livre, e-mail, nome, nota, lesão, peso, parceiro de sparring e resultado de pancada **não passam**: um valor fora do formato derruba o evento inteiro.
- **`filtrarEnvio` é a última barreira**, chamada pelo PostHog antes de cada envio. Só os seis eventos (e o `$identify`) saem; qualquer outro, como clique, pageview, exceção ou gravação de tela, é descartado, **mesmo que alguém o ligue no painel do PostHog**. Também tira a query e o hash das URLs (a volta do pagamento traz o id de uma sessão do Stripe), remove propriedades de pessoa (`$set`, `$set_once`) e qualquer propriedade com cara de e-mail.
- **Desligado de propósito:** captura automática de cliques e textos, gravação de tela, mapas de calor, captura de exceções, pageview automático, pesquisas, experimentos e flags remotas, e o carregamento de scripts extras. Sem os recursos remotos, uma mudança no painel do PostHog não consegue ligar a gravação de tela.
- **Pessoa só depois de identificar** (`person_profiles: identified_only`), guardado só no `localStorage` (**sem cookie**), respeitando "não rastrear" (`respect_dnt`), sem parâmetros de campanha.
- **A identificação usa só o id**, nunca e-mail ou nome. Um teste recusa qualquer id com cara de e-mail.
- **Dois testes vigiam o código:** só `lib/posthog.ts` pode importar o `posthog-js`, ninguém chama `capture` direto, e nenhuma chamada de `track` pode carregar palavras como e-mail, nome, nota, lesão ou peso (`tests/analytics-uso.test.ts`).

### Antes de abrir o app ao público (LGPD)

Os eventos de treino (esforço percebido, duração) são, na prática, informação de saúde, e o id da conta torna os eventos pessoais. Para uso com você e quem você convidar, isso é aceitável. **Antes de abrir ao público**, o app precisa de: política de privacidade que cite o PostHog e esses eventos, um aviso ou consentimento e uma forma de desligar as métricas (por exemplo, uma chave no Perfil). Para excluir uma conta, também é preciso apagar a pessoa no PostHog.

## Como ligar

1. No PostHog: **Project settings** → **Project API key**. Ela começa com `phc_` e é **pública**: pode ir no navegador. Anote também a região do projeto (Estados Unidos ou Europa).
2. No `.env.local`:
   - `NEXT_PUBLIC_POSTHOG_KEY` = a chave `phc_…`;
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com` (Estados Unidos) ou `https://eu.i.posthog.com` (Europa). Se faltar, vale o dos Estados Unidos.
3. `npm run verificar-env` confere o formato. Ele **recusa** a chave pessoal (`phx_…`) e a secreta do projeto (`phs_…`): elas dão acesso à conta, e esta variável vai para o navegador de todo mundo.
4. **Vercel:** cadastre as mesmas variáveis em Production e faça um **novo deploy**. A chave entra no código **na hora do build**, então só um novo deploy a coloca no ar.

Com a chave no `.env.local`, o `npm run dev` também envia eventos. Use um projeto do PostHog separado para desenvolvimento, ou deixe o `.env.local` sem a chave. Os testes automáticos nunca enviam nada: a configuração deles zera a chave.

## Como verificar

- `npm test`: `tests/analytics.test.ts` (propriedades, filtro, configuração), `tests/analytics-uso.test.ts` (o código) e os testes de ambiente e de segredos.
- `npm run e2e`: `e2e/analytics.spec.ts` prova que, **sem chave, nenhum pedido ao PostHog é feito** e nada é guardado no aparelho.
- **`npm run posthog:verificar`**: constrói o app com uma chave de **mentira**, intercepta a rede para o PostHog e confere, evento por evento, o que sairia do navegador: nomes, propriedades, endereços chamados, e que nada sensível vai junto. Leva alguns minutos e deixa o build com a chave falsa (rode `npm run build` depois).
- No PostHog de verdade: **Activity → Live events** mostra os eventos chegando.

## Detalhes úteis

- O `posthog-js` descarta eventos de navegador que parece robô (user agent `HeadlessChrome` e `navigator.webdriver`). É o certo para visitantes reais; por isso o script de verificação disfarça só isso.
- `$identify` pode aparecer mais de uma vez por pessoa (a cada carga de página logada). O PostHog trata isso sem duplicar a pessoa.
- Não há `$pageview`: o combinado foram os seis eventos. Se quiser páginas visitadas, é uma decisão à parte (a URL já sai sem query).

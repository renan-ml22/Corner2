# Corner — Plano de pagamento com Stripe

Estado: **versão de teste concluída.** P0 a P4 prontas e verificadas contra o Stripe de teste. Falta o seu teste manual (roteiro abaixo) e, para vender de verdade, a conta com banco (seção "Depois do teste").

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Gateway | Stripe, em **modo de teste** até o fim |
| Banco de dados | **Sem banco por enquanto** (é um teste). O Stripe passa a ser a fonte da verdade da assinatura |
| Cobrança | Assinatura **mensal e anual** |
| Teste grátis | **7 dias, sem cartão** |
| Preço do Profissional | **R$ 69,90** |
| O que cada plano libera | **Por recursos do app** (lista proposta abaixo) |

## Preços

| Plano | Mensal | Anual (proposta ❓) |
|---|---|---|
| Iniciante | R$ 39,90 | R$ 399,00 |
| Amador | R$ 52,90 | R$ 529,00 |
| Profissional | R$ 69,90 | R$ 699,00 |

**Anual decidido:** 10× o mensal (2 meses grátis). No código é um número só (`ANUAL_EM_MESES`). Atenção: no Stripe o valor de um preço não se edita; mudar o anual depois cria um preço novo e arquiva o antigo (o script faz isso sozinho).

## Como funciona sem banco (e o que isso limita)

**Idéia:** o app identifica a pessoa pelo e-mail da conta de teste, cria um *Customer* no Stripe com esse e-mail e **pergunta ao Stripe** qual assinatura está ativa. Não guardamos nada nosso.

```
Pessoa → /assinatura (escolhe plano e período)
       → nosso servidor cria uma Checkout Session no Stripe
       → página de pagamento do Stripe (cartão de teste 4242 4242 4242 4242)
       → volta para /assinatura?ok=1
       → nosso servidor consulta o Stripe e libera os recursos do plano
       → "Gerenciar assinatura" abre o Portal do Cliente do Stripe (trocar plano, cartão, cancelar)
```

O estado da assinatura fica num cookie assinado de curta duração (5 min), para não consultar o Stripe a cada tela. Ao voltar do pagamento e ao abrir a tela de assinatura, ele é atualizado na hora.

**Limites honestos desta versão de teste:**
- Só funciona para o **usuário de teste único**. Não há cadastro: outras pessoas não conseguem assinar.
- Trocar de plano ou cancelar no Portal leva até 5 minutos para refletir nos recursos (por causa do cookie), a não ser que a pessoa abra a tela de assinatura.
- Sem webhook, se a pessoa pagar e fechar a aba antes de voltar ao app, a liberação acontece no próximo acesso. Funciona, mas é menos elegante. O webhook entra na versão com banco.
- **Não é uma versão para vender de verdade.** Para cobrar clientes reais é preciso conta de usuário e banco (ver "Depois do teste").

## O que cada assinatura libera (em vigor)

Fica toda em **uma tabela** (`lib/assinatura/catalogo.ts`): mudar um recurso de plano é mudar uma linha (e rodar `npm run stripe:sincronizar` para atualizar a descrição dos produtos no Stripe). O **plano gratuito** foi decisão sua; o que ele inclui foi definido assim:

| Recurso | Gratuito | Iniciante | Amador | Profissional |
|---|:-:|:-:|:-:|:-:|
| Registrar treino, histórico e progresso | ✓ | ✓ | ✓ | ✓ |
| Cronômetro de rounds | ✓ | ✓ | ✓ | ✓ |
| **Registrar pancadas na cabeça e lesões, com os alertas de segurança** | ✓ | ✓ | ✓ | ✓ |
| Exportar os próprios dados | ✓ | ✓ | ✓ | ✓ |
| Biblioteca técnica | | ✓ | ✓ | ✓ |
| Plano de treino Fundamentos | | ✓ | ✓ | ✓ |
| Planos Base Aeróbica e Técnica Avançada | | | ✓ | ✓ |
| Check-in diário e ajuste do treino do dia | | | ✓ | ✓ |
| Carga de treino e alerta de sobrecarga | | | ✓ | ✓ |
| Peso, categoria e gráfico de peso | | | ✓ | ✓ |
| Reagendar sessões | | | ✓ | ✓ |
| Plano Pré-competição | | | | ✓ |
| Intensidade e parceiro no sparring, e resumo de pancadas dos últimos 30 dias | | | | ✓ |
| Alerta de perda rápida de peso | | | | ✓ |
| Importar backup | | | | ✓ |
| Lembrete diário | | | | ✓ |

**Os alertas de segurança ficam em todos os planos, inclusive no gratuito, e o registro que os alimenta também.** Aviso de pancada forte na cabeça e de lesão ativa protege a saúde de quem treina, e esconder isso atrás de pagamento é arriscado para as pessoas e para a marca. Um teste de navegador garante isso para o gratuito, o Iniciante e a assinatura cancelada. Os alertas de **carga** são do plano Amador.

**Exportar os próprios dados:** recomendo permitir sempre, mesmo sem assinatura (a LGPD prevê portabilidade de dados). Por isso o backup talvez não deva ser exclusivo do Profissional ❓.

## Quando não há assinatura ativa: modo gratuito limitado (decidido)

Quem nunca assinou, cancelou ou deixou o teste terminar usa o plano gratuito. Os recursos bloqueados mostram um convite ("Disponível a partir do plano X") com o caminho para assinar. **Nada é apagado**: se o plano de treino escolhido deixa de estar incluído, os dados dele ficam guardados e voltam quando a pessoa assinar de novo. Se o pagamento não está ligado no ambiente (sem chave do Stripe), **o app fica todo liberado**, como era antes.

## Período de teste grátis (decidido)

**7 dias, sem cartão**, só na primeira assinatura. Quem já teve qualquer assinatura paga desde o início, com cartão. Se a pessoa não cadastrar um cartão até o fim do teste, a assinatura é cancelada e ela volta ao gratuito. Trocar de plano durante o teste **não** encerra o teste nem cobra na hora.

## Fases

Cada fase com teste primeiro, como no resto do projeto, e em uma branch com CI verde antes de ir à `main`.

**Fase P0 — o que só você pode fazer (10 min)**
1. No painel do Stripe, **modo de teste ligado** (chave `sk_test_...`).
2. Em *Developers → API keys*, copie a **chave secreta de teste** e a **chave publicável de teste**.
3. Cole **no `.env.local`** (nunca no chat): `STRIPE_SECRET_KEY=sk_test_...` e `STRIPE_PUBLISHABLE_KEY=pk_test_...`. Eu leio o arquivo sem mostrar os valores.
4. Em *Settings → Billing → Customer portal*, clique em **Activate** (troca de plano, cartão e cancelamento).
5. Para a Vercel: cadastrar as mesmas variáveis em *Preview* (o teste não vai para *Production* com chave de teste).

**Fase P1 — domínio da assinatura (puro, testável)**
- `lib/assinatura/catalogo.ts`: os 3 níveis, preços, períodos e a tabela de recursos.
- `lib/assinatura/regras.ts`: `podeUsar(recurso, nivel)`, ordenação de níveis, estado (`teste`, `ativa`, `atrasada`, `cancelada`, `nenhuma`).
- `lib/assinatura/stripe-para-estado.ts`: converte uma assinatura do Stripe (`status`, `items[].price.lookup_key`, `trial_end`, `current_period_end`) no nosso estado. Testes com dezenas de formas de resposta do Stripe.

**Fase P2 — produtos e preços no Stripe (script único, repetível)**
- `scripts/stripe-criar-produtos.mjs`: cria 3 produtos e 6 preços em **BRL** com `lookup_key` (`iniciante_mensal`, `amador_anual` etc.). Rodar duas vezes não duplica. Valores em centavos, vindos do mesmo catálogo.

**Fase P3 — rotas de servidor (concluída)**
- `POST /api/assinatura/checkout`: exige sessão; cria o Customer (por e-mail) e a Checkout Session; devolve o endereço.
- `POST /api/assinatura/portal`: abre o Portal do Cliente.
- `GET /api/assinatura/estado`: consulta o Stripe e renova o cookie de estado.
- Proteção: só usuário logado; origem verificada; a chave secreta só no servidor (`server-only`).

**Fase P4 — telas e liberação de recursos**
- Tela **Assinatura** (nova aba em Perfil ou rota própria) com os 3 planos, alternância mensal/anual e o estado atual.
- Hook `useAssinatura()` e componente `<ExigePlano recurso="...">` que mostra um convite ao upgrade no lugar do recurso bloqueado.
- Aplicar em cada recurso da tabela, sem quebrar os dados guardados.

**Fase P5 — testes**
- Unidade: catálogo, regras, conversão do Stripe.
- Navegador: fluxo completo com o Stripe **simulado** (o CI nunca chama a API real nem usa chave).
- Manual, com o Stripe de teste de verdade: cartão `4242 4242 4242 4242` (aprova), `4000 0000 0000 0002` (recusa), `4000 0025 0000 3155` (pede autenticação). Eu te passo o roteiro.

**Fase P6 — checklist de produção (só depois de ter conta de usuário)**
Ver abaixo.

## Depois do teste: o que falta para cobrar clientes reais

1. **Contas de usuário e banco** (a fase que adiamos). Hoje só existe o usuário de teste.
2. **Webhook** no Stripe (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) gravando o estado no banco, com verificação de assinatura.
3. Chaves **reais** (`sk_live_`) só na Vercel *Production*, com a conta do Stripe ativada para o Brasil.
4. **Termos de uso e Política de privacidade** publicados e linkados na tela de assinatura e no cadastro.
5. **Nota fiscal**: o Stripe não emite. Combine com seu contador.
6. **Direito de arrependimento** (compra online no Brasil, em geral 7 dias, CDC art. 49) e política de cancelamento e reembolso: confirmar com contador ou advogado.
7. **Pix e boleto** em assinatura recorrente têm restrições: confirmar no painel o que a sua conta oferece. No teste, cartão.
8. E-mails de recibo e de falha de pagamento configurados no Stripe.

## Limitação importante da versão sem banco: a liberação é só de interface

Os dados do atleta (treinos, plano, saúde) ficam **no navegador dele**, não num servidor nosso. Por isso, esconder um recurso de quem não assinou é uma decisão **de tela**: quem souber usar as ferramentas do navegador consegue contornar. Isso é aceitável para um teste e para o produto de hoje (não há conteúdo nosso protegido no servidor), mas **não é uma proteção real**. A proteção de verdade só existe quando o dado e a regra moram no servidor, o que depende da conta com banco de dados.

O que já é protegido de verdade, no servidor: quem pode **criar a cobrança** e **abrir o portal** (só usuário logado, vindo do próprio site, com plano de uma lista fechada, uma assinatura por pessoa, teste grátis só na primeira vez).

## Como testar a integração

- `npm run stripe:sincronizar`: cria ou conserta produtos, preços e Portal (só conta de teste; pode rodar quantas vezes quiser).
- `npm run stripe:fumaca`: exercita o mesmo código das rotas contra o Stripe de teste de verdade (teste grátis, assinatura duplicada, portal, troca de plano, cancelamento) e limpa o que criou.
- Pagamento de verdade na página do Stripe (cartão `4242 4242 4242 4242`) é o teste manual da fase P4.

## Riscos

| Risco | Mitigação |
|---|---|
| Chave secreta vazar | Só em variáveis de ambiente; `server-only`; teste automático que impede `sk_` no código e no navegador; nunca colar no chat |
| Cobrar errado | Valores só em centavos, de uma tabela; teste que confere os 6 preços; tudo em modo de teste. A troca de plano durante o teste grátis foi configurada para não cobrar na hora (verificado no Stripe) |
| Liberar recurso sem pagar | A decisão vem do Stripe no servidor, nunca de dado do navegador; cookie assinado |
| Bloquear recurso de quem pagou | O estado tem tolerância: assinatura `past_due` mantém acesso por alguns dias |
| Cobrança com o app errado em produção | Variáveis de teste só em *Preview*; checagem no CI de que `sk_live` não está no repositório |

## Roteiro de teste manual (com o Stripe de teste, na sua máquina)

1. Rode `npm run dev` e entre com o seu usuário. Como o `.env.local` tem as chaves de teste, o pagamento está ligado, e você começa no **plano gratuito**: veja o Perfil ("Plano gratuito"), a Biblioteca técnica (bloqueada) e o check-in na tela Hoje (bloqueado).
2. Em **Perfil → Assinatura**, escolha **Amador** e clique em **Começar 7 dias grátis**. Na página do Stripe, clique em **Iniciar teste** (não pede cartão). Você volta ao app com "Tudo certo!" e "Teste grátis do Amador".
3. Confira que check-in, carga, peso e biblioteca abriram.
4. Clique em **Mudar para este plano** no Profissional: o portal abre direto na confirmação, mostrando **valor devido hoje R$ 0,00** (o teste continua).
5. Em **Gerenciar assinatura → Adicionar forma de pagamento**, use o cartão `4242 4242 4242 4242` (qualquer data futura e qualquer CVC).
6. Cancele pelo portal: o app passa a mostrar "Cancelada: vale até…".
7. Para refazer do zero: no painel do Stripe (modo de teste), abra **Clientes**, abra o seu cliente e apague-o. A tela volta ao plano gratuito.

Cartões de teste úteis: `4000 0000 0000 0341` (aceita o cadastro, mas recusa a cobrança: simula pagamento atrasado) e `4000 0000 0000 0002` (recusado).

## Na Vercel (produção)

**Não cadastre as chaves de teste na Vercel.** Sem `STRIPE_SECRET_KEY`, o site publicado funciona como antes (tudo liberado) e a tela Assinatura mostra "Pagamento ainda não disponível". Só ligue o pagamento em produção com chaves reais (`sk_live_`), o webhook configurado e a conta com banco de dados, e antes revise a seção abaixo.

## O que preciso de você

1. ❓ Confirmar ou ajustar **a divisão de recursos** acima.
2. ❓ **Preço do Profissional**: 69,99 ou 69,90?
3. ❓ **Anual**: 10 × o mensal (2 meses grátis) serve?
4. ❓ **Teste grátis**: 7 dias sem cartão?
5. ❓ **Sem assinatura**: só a tela de planos (e backup liberado), ou um modo gratuito limitado?
6. A **Fase P0** (chaves de teste no `.env.local` e Portal ativado).

# Corner — Plano de pagamento com Stripe

Estado: **em andamento.** Concluídas: P0 (chaves de teste), P1 (regras puras), P2 (produtos, preços e Portal no Stripe) e P3 (rotas de servidor). Próxima: P4 (tela de assinatura e liberação de recursos). Pontos com ❓ ainda dependem de confirmação.

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

## O que cada assinatura libera ❓ (proposta para você ajustar)

O app tem pouca coisa que "parece premium", então esta divisão é uma proposta. Ela fica toda em **uma tabela** (`lib/assinatura/catalogo.ts`): mudar um recurso de plano é mudar uma linha.

| Recurso | Iniciante | Amador | Profissional |
|---|:-:|:-:|:-:|
| Registrar treino, histórico e progresso | ✓ | ✓ | ✓ |
| Cronômetro de rounds | ✓ | ✓ | ✓ |
| Biblioteca técnica | ✓ | ✓ | ✓ |
| **Alertas de segurança** (pancada na cabeça, lesão ativa) | ✓ | ✓ | ✓ |
| Plano de treino Fundamentos | ✓ | ✓ | ✓ |
| Planos Base Aeróbica e Técnica Avançada | | ✓ | ✓ |
| Check-in diário e ajuste do treino do dia | | ✓ | ✓ |
| Carga de treino e alerta de sobrecarga | | ✓ | ✓ |
| Saúde: peso, categoria e lesões | | ✓ | ✓ |
| Reagendar sessões | | ✓ | ✓ |
| Plano Pré-competição | | | ✓ |
| Sparring detalhado com resumo de pancadas na cabeça | | | ✓ |
| Alerta de perda rápida de peso | | | ✓ |
| Backup (exportar e importar) e lembrete diário | | | ✓ |

**Recomendação: os alertas de segurança ficam em todos os planos.** Aviso de pancada forte na cabeça e de lesão ativa protege a saúde de quem treina, e esconder isso atrás de pagamento é arriscado para as pessoas e para a marca.

**Exportar os próprios dados:** recomendo permitir sempre, mesmo sem assinatura (a LGPD prevê portabilidade de dados). Por isso o backup talvez não deva ser exclusivo do Profissional ❓.

## Quando não há assinatura ativa ❓

Proposta: a pessoa entra e vê só a tela **Assinatura** (com os planos). Os dados dela ficam guardados no aparelho e **nada é apagado**. Ela pode exportar o backup. Ao assinar, tudo volta. Alternativa: um modo gratuito limitado.

## Período de teste grátis ❓

Proposta: **7 dias** sem exigir cartão (`payment_method_collection: if_required`). Sem cartão, converte menos, mas gera menos disputas. Se preferir cartão no início, é uma linha.

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
| Cobrar errado | Valores só em centavos, de uma tabela; teste que confere os 6 preços; tudo em modo de teste |
| Liberar recurso sem pagar | A decisão vem do Stripe no servidor, nunca de dado do navegador; cookie assinado |
| Bloquear recurso de quem pagou | O estado tem tolerância: assinatura `past_due` mantém acesso por alguns dias |
| Cobrança com o app errado em produção | Variáveis de teste só em *Preview*; checagem no CI de que `sk_live` não está no repositório |

## O que preciso de você

1. ❓ Confirmar ou ajustar **a divisão de recursos** acima.
2. ❓ **Preço do Profissional**: 69,99 ou 69,90?
3. ❓ **Anual**: 10 × o mensal (2 meses grátis) serve?
4. ❓ **Teste grátis**: 7 dias sem cartão?
5. ❓ **Sem assinatura**: só a tela de planos (e backup liberado), ou um modo gratuito limitado?
6. A **Fase P0** (chaves de teste no `.env.local` e Portal ativado).

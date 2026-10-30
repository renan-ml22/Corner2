# Roteiro de teste em celular real

Serve para o que o navegador do computador não enxerga: som, vibração, tela acesa, instalação, modo avião e notificação. Repita a cada entrega que mexa em cronômetro, offline ou instalação.

**Tempo:** cerca de 25 minutos. **Precisa de:** o celular, o Wi-Fi ligado e a senha de teste.
**Endereço:** `https://corner2.vercel.app`

## Antes de começar

- [ ] Volume de mídia alto. **iPhone:** o botão lateral de silêncio (ou o modo Silencioso) **cala os sons do app**; deixe desligado.
- [ ] Brilho médio e bloqueio automático de tela curto (30 s), para provar que o app mantém a tela acesa sozinho.
- [ ] Android: use o **Chrome**. iPhone: use o **Safari**.
- [ ] Anote o modelo e a versão do sistema (ex.: "Galaxy A54, Android 14" ou "iPhone 13, iOS 17").

---

## 1. Instalar o app

**Android (Chrome):** menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
**iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

- [ ] O ícone aparece na tela inicial com a **luva e as cordas** (não uma letra ou um quadrado em branco).
- [ ] O nome embaixo do ícone é **Corner**.
- [ ] Ao tocar no ícone, o app abre **sem a barra de endereço** (tela cheia).
- [ ] Ele abre direto na tela **Hoje** (ou no login, se a sessão tiver expirado).
- [ ] A barra de status do celular fica escura, combinando com o fundo do app.

## 2. Login e telas

- [ ] O login aparece com o cartão de **vidro** (fundo desfocado atrás) e a luva animada.
- [ ] Ao tocar no campo de senha, o **teclado não cobre** o botão "Entrar" (dá para rolar até ele).
- [ ] Digitar o e-mail ou a senha **não dá zoom** na tela (no iPhone isso era um risco).
- [ ] Entrar com a senha certa leva ao app.
- [ ] Em **Hoje, Plano, Progresso, Perfil, Saúde e Técnicas**: nada fica **cortado** no topo (entalhe/câmera) nem **escondido atrás da barra inferior**.
- [ ] A barra inferior (Hoje, Plano, **+**, Progresso, Perfil) fica fixa e translúcida, e o botão **+** vermelho está inteiro.

## 3. Cronômetro de rounds (o mais importante)

Abra este endereço, que faz um treino curto (2 rounds de 30 s, descanso de 15 s, cerca de 1 min 30 s no total):

`https://corner2.vercel.app/treino?tipo=tec&rounds=2&min=0.5&descanso=15`

Toque em **Começar**. Fique com o celular na mão, sem bloquear a tela.

| O que acontece | Esperado | OK? |
|---|---|---|
| Primeiros 10 s | Tela de **Prepare-se**; nos últimos 3 s, **bips** 3-2-1 | [ ] |
| Começa o round 1 | **1 batida de sino** + vibração longa (Android) | [ ] |
| Últimos 10 s do round | Som de **matraca** e vibração curta; aparece "Últimos segundos: dê tudo" | [ ] |
| Começa o descanso | **2 batidas de sino**; nos últimos 3 s, bips 3-2-1 | [ ] |
| Começa o round 2 | 1 batida de sino | [ ] |
| Fim | **3 batidas de sino** e a tela "Treino concluído!" | [ ] |
| Tela acesa | A tela **não apaga** durante todo o treino, mesmo sem tocar | [ ] |

Depois, **sem fechar o app**, repita um treino e teste:

- [ ] **Pausar** e **Retomar**: o tempo para e continua de onde parou.
- [ ] **Pular fase**: vai para a fase seguinte e toca o sino dela.
- [ ] **Encerrar** pede confirmação e leva ao resumo com os rounds feitos.
- [ ] **Travar a tela** com o botão lateral por 20 s e destravar: o relógio **continua certo** (conta pelo tempo real, não perde segundos). *Os sons com a tela travada são testados na seção 3b.*
- [ ] Em "Treino concluído", **Registrar treino** abre o painel já com os rounds e a **duração real**.

> **Vibração no iPhone não existe** (o Safari não permite). Deve só não vibrar, **sem erro**.

## 3b. Timer em segundo plano (sons com a tela bloqueada ou em outro app)

Os sons do Timer são programados de uma vez no início (`docs/plano-timer.md`, "Sons em segundo plano"). Este teste mostra se o seu aparelho os toca com o app fora da tela. **Anote o resultado em cada linha, mesmo quando falhar:** é o que diz se a opção extra precisa virar padrão.

Na aba **Timer**, em **Ajustes**: 2 rounds de 20 s, descanso de 10 s, preparação ligada (total de cerca de 1 min). Deixe **"Manter o som com a tela bloqueada" desligada** nas partes A e B.

**A. Outro app (opção desligada).** Toque em **INICIAR**, vá para outro app (ou outra aba) e fique uns 25 s; volte.
- [ ] O relógio está **certo** ao voltar (não parou, não atrasou).
- [ ] Você **ouviu** sino ou bips enquanto estava fora? (sim / não / só alguns)
- [ ] Ao voltar, **não** tocou um sino velho de uma vez (som atrasado não deve tocar).

**B. Tela travada (opção desligada).** Toque em **INICIAR** e logo trave a tela com o botão lateral; espere o treino todo (cerca de 1 min), sem mexer.
- [ ] Você ouviu os sinos e os bips na hora certa? (sim / não / só alguns)
- [ ] Ao destravar, a tela mostra o **fim do treino** (ou o tempo certo, se ainda não acabou).

**C. Com a opção ligada.** Nos Ajustes, ligue **"Manter o som com a tela bloqueada"** e repita A e B.
- [ ] Os sons tocaram na hora certa com a tela travada? (sim / não / só alguns)
- [ ] Apareceu o controle de mídia **Corner · Timer** na tela de bloqueio, com o round?
- [ ] O botão **pausar** do controle de mídia pausou o timer, e **play** retomou?
- [ ] Se havia música de outro app tocando, ela **parou**? (esperado: pode parar; é o custo da opção)
- [ ] Ao encerrar ou terminar o treino, o controle de mídia **sumiu**.

**D. Pausa.** Com o timer andando, **pause** por 20 s e retome.
- [ ] Nenhum som tocou durante a pausa, e os sons seguintes saíram só depois de retomar, no tempo certo.

## 4. Registrar um treino

- [ ] Pelo botão **+**: escolher o tipo, ajustar rounds e esforço, **Salvar treino**.
- [ ] O painel sobe de baixo com animação e fecha ao tocar fora, em **Fechar** ou em **Concluir**.
- [ ] Em **Progresso**, o treino aparece no histórico.
- [ ] Em **Sparring** com "Pancadas na cabeça: Fortes", aparece o **aviso de saúde** vermelho no fim.

## 5. Modo offline

1. Com Wi-Fi, abra **Hoje, Plano, Progresso** e o **cronômetro** (cada uma pelo menos uma vez) e aguarde alguns segundos.
2. Ative o **modo avião** (desligue também o Wi-Fi).

- [ ] Abrir o app pelo ícone: **Hoje** abre com seus dados.
- [ ] **Plano** e **Progresso** abrem (já foram visitadas).
- [ ] O **cronômetro abre e funciona**, com sons.
- [ ] Uma tela **nunca visitada** (ex.: Técnicas, se você não abriu) mostra a página **"sem conexão"** do Corner, sem erro feio do navegador.
- [ ] Registrar um treino sem internet **funciona** (os dados ficam no aparelho).

Desligue o modo avião ao terminar.

## 6. Lembrete diário

Em **Perfil → Preferências**: ligue **Lembretes** e escolha um horário **2 minutos à frente**. Permita as notificações quando o navegador pedir.

- [ ] O pedido de permissão aparece (e, ao permitir, some o aviso de "notificações bloqueadas").
- [ ] **Com o app aberto**, no horário escolhido, chega a notificação **"Hora de treinar"**.
- [ ] Ela **não repete** no mesmo dia.
- [ ] **Com o app fechado**, a notificação **não chega**. *Esse é o limite conhecido: avisar com o app fechado exige o servidor de notificações, da fase da conta com banco de dados.*

> **iPhone:** notificações só funcionam com o app **instalado** na Tela de Início e no iOS 16.4 ou mais novo. Se não chegar, anote, mas pode ser limite do iOS.

## 7. Backup

Em **Perfil → Backup dos dados**:

- [ ] **Baixar backup** salva um arquivo `corner-backup-AAAA-MM-DD.json` (Android: Downloads; iPhone: pergunta onde salvar).
- [ ] **Importar** aceita esse mesmo arquivo, pede confirmação e mostra "Backup importado".

## 8. Sair da conta

- [ ] **Perfil → Sair da conta** volta ao login.
- [ ] Voltar para uma tela protegida (ex.: abrir `/hoje`) leva ao login de novo.

---

## Resultado

| Seção | Passou? | Observação (o que viu, em qual celular) |
|---|---|---|
| 1. Instalar | | |
| 2. Login e telas | | |
| 3. Cronômetro | | |
| 4. Registrar treino | | |
| 5. Offline | | |
| 6. Lembrete | | |
| 7. Backup | | |
| 8. Sair | | |

Se algo falhar, anote: **o que você fez, o que esperava, o que aconteceu** e, se puder, tire um print ou grave a tela. Com isso dá para corrigir sem adivinhar.

## Limites conhecidos (não são defeitos)

- **Vibração:** não existe no iPhone.
- **Sons com a tela travada ou o app em segundo plano:** o navegador pode silenciar. O relógio continua certo.
- **Lembrete com o app fechado:** não existe ainda (precisa de notificações push).
- **iPhone, botão de silêncio:** cala os sons do cronômetro.

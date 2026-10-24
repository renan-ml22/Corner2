# Corner — Exercícios, quiz de estilo e treinos de atletas

Estado: **código pronto e testado** (testes de unidade, de navegador e de acessibilidade). Nada disso precisa de configuração nova: não há chave, variável de ambiente nem tabela nova no banco.

## O que a pessoa vê

| Tela | Endereço | Quem usa |
|---|---|---|
| Biblioteca de exercícios | `/exercicios` | **Gratuito** |
| Quiz de estilo (5 perguntas e resultado) | `/quiz` e `/quiz?r=01203` | **Gratuito** |
| Estilo e plano de um atleta | `/atletas/[id]` | Ver: gratuito. **Treinar como: plano Profissional** |

Entrada: dois atalhos ("Exercícios" e "Quiz de estilo") na tela **Plano** (nas três versões dela: sem plano, com plano e com plano bloqueado) e em **Para evoluir**, na tela **Hoje**. As três telas novas ficam na aba **Plano** da barra de baixo (`lib/navegacao.ts`).

### Exercícios

20 exercícios em 5 categorias (Footwork 4, Esquivas de cabeça 4, Esquivas de tronco 3, Golpes 5, Combinações 4). Cada um tem descrição (2 a 3 frases), 3 dicas, 2 erros comuns e nível. A tela tem abas de categoria que rolam para o lado e, ao tocar num exercício, um painel que sobe de baixo com tudo isso e o aviso **"Em breve: vídeo"**. Os textos estão em `data/exercicios.ts`.

### Quiz

5 perguntas, uma por tela, com barra de progresso, animação ao trocar de pergunta, botão "Pergunta anterior" (a resposta já dada fica marcada) e foco no título de cada pergunta (leitor de tela). No fim aparecem **dois atletas** com a porcentagem de compatibilidade.

- **O resultado mora no endereço** (`/quiz?r=01203`, um dígito por pergunta): o botão Voltar do navegador volta ao resultado depois de abrir um atleta, e recarregar a página não perde nada. Um endereço inválido (letra, tamanho errado, número fora do intervalo) recomeça o quiz. Nada é enviado a servidor: a conta é feita na tela.
- **Como a porcentagem é calculada** (`lib/quiz.ts`): cada resposta soma pontos em categorias (a tabela está em `data/quiz.ts`, igual à combinada). Cada atleta tem 3 pontos fortes. A compatibilidade é a **média de duas razões**: (pontos nos pontos fortes do atleta ÷ o máximo que as respostas podem dar a ele) e (pontos nos pontos fortes do atleta ÷ total de pontos da pessoa). Empate: mais pontos brutos, depois a ordem de `ATLETAS`.
- **Por que não só somar os pontos:** cinco características (alcance, físico, adaptação, reflexo e combinações) não recebem ponto de nenhuma resposta. Somando direto, Robson Conceição **nunca** aparecia no resultado e Teófilo Stevenson aparecia 1 vez em 576. Um teste percorre as **576 combinações** de resposta e exige que todos os 10 atletas apareçam entre os dois primeiros em pelo menos 5% delas, e que nenhum apareça em mais de 40%.

### Atletas e treinos

10 atletas (`data/atletas.ts`), cada um com um treino de **4 semanas** "no estilo de" (`data/planos-atletas.ts`, plano `atleta-<id>`), que entra como **plano ativo** quando a pessoa toca em "Treinar como [Nome]" (pede confirmação se já houver outro plano).

- Sem foto: cada atleta é uma bolinha com a cor e as iniciais dele (`components/AtletaAvatar.tsx`).
- Os 4 planos de sempre continuam sendo os únicos de `PLANOS` (a tela de escolher plano não mudou); `getPlano` acha também os dos atletas, então plano ativo, sessões, checklist, cronômetro e sincronização funcionam sem mudança.
- Progressão: as semanas 3 e 4 têm 1 round a mais por sessão que as semanas 1 e 2, **menos o sparring, que não aumenta** (no máximo 1 por semana, 4 rounds, técnico, leve e a 50%, com luvas, capacete e um treinador por perto). Um teste confere o salto, o equipamento e que o nível do plano não seja menor que o dos exercícios que ele cita.
- Estes pontos vieram da revisão independente de um subagente (ver `git log`): joelho acompanhando o pé nos giros (pivot, direto, gancho), cotovelo sem travar (jab, direto), soltar o ar a cada golpe, shoulder roll contra golpes retos de trás, e o fato de que **Robson Conceição luta na guarda ortodoxa** (o texto original o chamava de "Southpaw veloz"; agora é "Boxeador veloz"). Ele e a Manny Pacquiao tinham a mesma cor; a do Robson mudou.

## O que é de cada plano

Em `lib/assinatura/catalogo.ts`: `exercicios` e `quizDeEstilo` são **gratuitos**; `treinosDeAtletas` é do **Profissional**, e os 10 planos `atleta-*` apontam para ele (um teste confere). Como no resto do app, o bloqueio é **de tela**: os dados ficam no aparelho, então não é uma proteção contra quem mexe no navegador (ver `docs/plano-pagamento.md`).

- Quem perde o Profissional **mantém o plano do atleta guardado**, mas vê o convite no lugar das sessões (mesmo comportamento dos outros planos).
- Ao mudar a lista de recursos, a descrição do produto Profissional no Stripe muda: rode `npm run stripe:sincronizar` (ver abaixo).

## Cuidados com os atletas (decisão de marca e jurídica ❓)

- Os textos descrevem o **estilo de luta**; nada diz que o atleta aprovou, participou ou criou o treino. Cada tela de atleta e o resultado do quiz trazem o aviso: *"Treino do Corner inspirado no estilo de luta de [Nome]. Não é a rotina real do atleta, e o Corner não tem vínculo com ele."* Um teste barra palavras como "oficial", "endossado", "parceria", "garantido" e "treino real".
- Mesmo assim, **usar o nome de pessoas reais num produto pago** pode exigir autorização (direito de imagem e de nome). Vale uma conversa com um advogado antes do lançamento público. Sem foto e sem logotipo é o mais seguro, e foi o que fizemos.
- O nome de pessoas reais também aparece na descrição do plano Profissional (Stripe e tela de Assinatura): "Treinos no estilo de 10 atletas (Muhammad Ali, Mike Tyson e outros)".

## Métricas

Um evento a mais, dentro da lista fechada: `sheet_opened` com `sheet_name: "exercicio"` quando o painel de um exercício abre (sem dizer qual). O quiz e os atletas **não** geram evento: a escolha de estilo de luta não é medida. `plan_selected` continua valendo para "Treinar como".

## Testes

- `tests/exercicios.test.ts`, `tests/atletas.test.ts`, `tests/quiz.test.ts` (inclui as 576 combinações), `tests/planos-atletas.test.ts`, `tests/navegacao.test.ts`.
- `tests/icones.test.ts`: confere que **todo ícone `ph-…` usado no app existe** na lista oficial do Phosphor 2.1.1 (`tests/phosphor-2.1.1-icones.txt`). Ícone que não existe aparece como um espaço vazio, sem nenhum erro. Esse teste achou um de verdade em código já publicado (`ph-seedling`, no onboarding, trocado por `ph-plant`).
- `e2e/exercicios-quiz.spec.ts`: atalhos, abas, os 20 painéis, quiz completo, endereço com as respostas, bloqueio por plano (gratuito, Iniciante, Amador e Profissional), ativar o plano, confirmação ao trocar, 404, barra de baixo e acessibilidade (axe) de cada tela.

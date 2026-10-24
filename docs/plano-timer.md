# Corner — Timer (cronômetro livre)

Estado: **pronto e testado** (unidade, navegador, acessibilidade). Não precisa de chave, variável de ambiente nem tabela no banco. **Gratuito em todos os planos** (faz parte do recurso `cronometro` do catálogo).

## O que é

A aba **Timer** da barra de baixo (`/timer`, ícone de cronômetro) é um cronômetro de rounds para usar sem plano: a pessoa escolhe rounds, tempo, descanso e liga. É diferente do cronômetro que abre a partir de uma sessão do plano (`/treino`, em tela cheia, com o foco de cada round): os dois usam o **mesmo motor** (`hooks/useCronometro.ts`), com sons, preparo e vibração configuráveis.

| Configuração | Opções | Padrão |
|---|---|---|
| Rounds | 1 a 20 | 3 |
| Tempo do round | 1:00 a 5:00, de 30 em 30 s | 3:00 |
| Descanso entre rounds | 30 s, 1, 2 ou 3 min | 1 min |
| Preparação de 10 s | ligada/desligada | ligada |
| Vibração ao trocar de fase | ligada/desligada | ligada |
| Volume e mudo | 0 a 100% | 80%, som ligado |

A configuração fica **só neste aparelho** (`localStorage`, chave `corner:timer:config`), não vai para a conta: som e tempos são gosto do aparelho. Um valor quebrado ou adulterado volta ao padrão campo por campo (`lib/timer.ts`).

## A tela

- A tela inteira muda de cor a cada fase: azul (preparação), vermelho (round), verde (descanso) e neutro (pronto e fim). O texto é escuro sobre as três cores, com contraste de pelo menos 4,5:1 (um teste confere lendo o CSS).
- Mostra "Round 2 / 3", a fase (PREPARAÇÃO, ROUND, DESCANSO, FIM; PAUSADO quando pausado), o tempo grande em MM:SS e um anel de progresso.
- Botões: INICIAR / PAUSAR / RETOMAR, Reiniciar (pede confirmação se estiver andando), Ajustes (painel que sobe de baixo), som ligado/desligado e "Encerrar e ver o resumo".
- **Rounds, tempos e preparo só mudam com o timer parado** (mudar com ele andando recriaria a contagem). Volume, mudo e vibração valem na hora.
- No fim, o resumo mostra rounds feitos e tempo total. **"Registrar este treino"** abre o registro já com os rounds, o tempo do round e a duração real; antes, a pessoa escolhe o tipo (Técnica, Condicionamento ou Sparring). O registro passou a aceitar até 20 rounds, como o timer.

## Sons

Gerados na hora com Web Audio (`lib/som-timer.ts`), sem arquivo e sem biblioteca. O áudio só é criado **depois do toque em INICIAR** (regra dos navegadores).

| Aviso | Som |
|---|---|
| Início do round | 3 bipes curtos (100 ms, com 150 ms entre eles) e 1 longo (600 ms), 880 Hz |
| Faltam 10 s do round | 1 bipe de 200 ms, 660 Hz |
| Fim do round / início do descanso | 1 bipe de 800 ms, 440 Hz |
| Fim de todos os rounds | 3 bipes de 400 ms: 880, 1100 e 1320 Hz |
| Últimos 3 s do preparo e do descanso | 1 bipe curto por segundo (acréscimo meu, igual ao cronômetro do plano) |

O "intervalo de 150 ms" do pedido foi lido como a **pausa entre os bipes** (os bipes começam a cada 250 ms). Se a ideia era 150 ms entre os inícios, é só mudar `BIPES_INICIO_DE_ROUND`.

## Limites (honestos)

- **App minimizado ou tela bloqueada:** o tempo segue o relógio do aparelho (não atrasa), mas o **navegador pode silenciar os sons e a vibração** com a página em segundo plano. O app pede para a tela não apagar (`wakeLock`) enquanto o timer anda, onde o aparelho permite. Só o teste no celular real mostra como o seu aparelho se comporta (`docs/teste-celular.md`, seção do cronômetro).
- **iPhone:** a vibração (`navigator.vibrate`) não existe no Safari; o painel avisa.
- Fechar a aba com o timer andando pede confirmação ao navegador; recarregar a página perde a contagem (não é guardada).

## Testes

`tests/timer.test.ts` (limites, validação, textos, cores), `tests/som-timer.test.ts` (bipes, volume, mudo, áudio de mentira), `tests/cronometro.test.ts` (fases, com e sem preparo), `tests/navegacao.test.ts` e `e2e/timer.spec.ts` (aba, configuração, andamento com relógio falso, sons, vibração, tela acesa, registro e axe em cada fase).

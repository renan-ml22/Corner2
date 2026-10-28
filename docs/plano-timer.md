# Corner — Timer (cronômetro livre)

Estado: **pronto e testado** (unidade, navegador, acessibilidade). Não precisa de chave, variável de ambiente nem tabela no banco. **Gratuito em todos os planos** (faz parte do recurso `cronometro` do catálogo).

## O que é

A aba **Timer** da barra de baixo (`/timer`, ícone de cronômetro) é um cronômetro de rounds para usar sem plano: a pessoa escolhe rounds, tempo, descanso e liga. É diferente do cronômetro que abre a partir de uma sessão do plano (`/treino`, em tela cheia, com o foco de cada round): os dois usam o **mesmo motor** (`hooks/useCronometro.ts`), com sons, preparo e vibração configuráveis.

| Configuração | Opções | Padrão |
|---|---|---|
| Rounds | 1 a 20 | 3 |
| Tempo do round | 0:10 a 10:00, de segundo em segundo (minutos + segundos de 0 a 59) | 3:00 |
| Descanso entre rounds | 0 (sem descanso) a 10:00, de segundo em segundo | 1 min |
| Preparação de 10 s | ligada/desligada | ligada |
| Vibração ao trocar de fase | ligada/desligada | ligada |
| Volume e mudo | 0 a 100% | 100%, som ligado |

A configuração fica **só neste aparelho** (`localStorage`, chave `corner:timer:config`), não vai para a conta: som e tempos são gosto do aparelho. Um valor quebrado ou adulterado volta ao padrão campo por campo (`lib/timer.ts`). Quem já tinha configuração guardada (round de 30 em 30 s, descanso de 30 s a 3 min) continua com ela: todos esses valores seguem válidos.

## A tela

- A tela inteira muda de cor a cada fase: azul (preparação), vermelho (round), verde (descanso) e neutro (pronto e fim). O texto é escuro sobre as três cores, com contraste de pelo menos 4,5:1 (um teste confere lendo o CSS).
- Mostra "Round 2 / 3", a fase (PREPARAÇÃO, ROUND, DESCANSO, FIM; PAUSADO quando pausado), o tempo grande em MM:SS e um anel de progresso.
- No painel de ajustes, round e descanso têm **minutos** (botões − e +) e **segundos** (barra de 0 a 59). Um round não aceita menos de 10 s.
- Botões: INICIAR / PAUSAR / RETOMAR, Reiniciar (pede confirmação se estiver andando), Ajustes (painel que sobe de baixo), som ligado/desligado e "Encerrar e ver o resumo".
- **Rounds, tempos e preparo só mudam com o timer parado** (mudar com ele andando recriaria a contagem). Volume, mudo e vibração valem na hora.
- No fim, o resumo mostra rounds feitos e tempo total. **"Registrar este treino"** abre o registro já com os rounds, o tempo do round e a duração real; antes, a pessoa escolhe o tipo (Técnica, Condicionamento ou Sparring). O registro passou a aceitar até 20 rounds, como o timer.

## Sons

Gerados na hora com Web Audio (`lib/som-timer.ts`), sem arquivo e sem biblioteca. O áudio só é criado **depois do toque em INICIAR** (regra dos navegadores).

| Aviso | Som |
|---|---|
| Início do round | **Sino de ringue**: uma badalada longa (~2,6 s) |
| Contagem dos últimos 3 s (preparação, **round** e descanso) | 3 bipes secos de onda quadrada, um por segundo, cada vez mais agudos: 1000, 1250 e 1600 Hz |
| Faltam 10 s do round | 1 bipe de 200 ms, 660 Hz |
| Fim do round / início do descanso | **"Ting ting ting"**: 3 badaladas de sino, uma a cada ½ s |
| Fim de todos os rounds | 4 badaladas de sino, a última mais longa |

Sequência de um treino: preparação (3‑2‑1) → sino → round → aviso dos 10 s → 3‑2‑1 → "ting ting ting" → descanso → 3‑2‑1 → sino → … → 3‑2‑1 → 4 badaladas.

O sino é sintetizado: 9 tons que não são múltiplos uns dos outros (é o que dá o som metálico), os agudos somem antes dos graves, entre 560 e 4070 Hz (o alto-falante de celular quase não reproduz o grave, mas reproduz bem a faixa de 2 a 4 kHz). **Não é uma gravação de sino de verdade**: soa como um sino sintético. Se a ideia for o som exato de um ringue, o caminho é um arquivo de áudio gravado (e com licença de uso); o resto do código não muda.

### Volume

O volume de 100% agora usa a força total (antes parava em 60%) e o sino passa por uma saturação suave (curva `tanh`), que o engorda sem passar do limite do alto-falante. Medido renderizando os sons no Chrome (sem alto-falante): no mesmo volume de 80%, o sino novo tem cerca de **5 dB** a mais de energia que o bipe de 880 Hz de antes (4 dB pesando como o ouvido escuta), e a contagem 3‑2‑1 ficou uns 8 dB acima. Quem já tinha o volume guardado em 80% fica mais alto sem mexer em nada. O aparelho em si ainda manda: o volume de mídia do celular limita tudo, e no iPhone o Safari costuma silenciar sons de páginas web com a chave de silencioso ligada (não dá para o app contornar; só o teste no celular confirma no seu).

## Limites (honestos)

- **App minimizado ou tela bloqueada:** o tempo segue o relógio do aparelho (não atrasa), mas o **navegador pode silenciar os sons e a vibração** com a página em segundo plano. O app pede para a tela não apagar (`wakeLock`) enquanto o timer anda, onde o aparelho permite. Só o teste no celular real mostra como o seu aparelho se comporta (`docs/teste-celular.md`, seção do cronômetro).
- **iPhone:** a vibração (`navigator.vibrate`) não existe no Safari; o painel avisa.
- Fechar a aba com o timer andando pede confirmação ao navegador; recarregar a página perde a contagem (não é guardada).

## Testes

`tests/timer.test.ts` (limites, validação, textos, cores), `tests/som-timer.test.ts` (bipes, volume, mudo, áudio de mentira), `tests/cronometro.test.ts` (fases, com e sem preparo), `tests/navegacao.test.ts` e `e2e/timer.spec.ts` (aba, configuração, andamento com relógio falso, sons, vibração, tela acesa, registro e axe em cada fase).

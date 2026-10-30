'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePainelAcoes } from '@/components/PainelProvider'
import Segmentos from '@/components/sheets/Segmentos'
import { useHidratado } from '@/hooks/useEntidade'
import { useConfigTimer } from '@/hooks/useConfigTimer'
import { useCronometro } from '@/hooks/useCronometro'
import { useSegundoPlano } from '@/hooks/useSegundoPlano'
import { definirTimerAndando, useTimerAndando } from '@/hooks/useTimerAndando'
import { criarSonsDoTimer } from '@/lib/som-timer'
import { TEXTOS } from '@/lib/textos'
import {
  PREPARO_DO_TIMER_SEG, detalheDaMidia, duracaoTotal, formatarTempo, minutosDoRound, rotuloDaFase, rotuloDoDescanso, type ConfigTimer, type FaseVisual,
} from '@/lib/timer'
import { CAT_LABELS, TIPOS, type RegType } from '@/lib/tipos'
import ConfiguracoesDoTimer from './ConfiguracoesDoTimer'
import estilos from './timer.module.css'

export default function TimerCliente() {
  const pronto = useHidratado()
  const [config, alterar] = useConfigTimer()
  const [reinicios, setReinicios] = useState(0)
  const andando = useTimerAndando()
  // Rounds, tempos e preparo ficam congelados enquanto o timer anda (outra aba do navegador mudando a configuração
  // não pode zerar a contagem). Volume, mudo e vibração seguem valendo na hora.
  const [estrutura, setEstrutura] = useState(() => estruturaDe(config))
  const nova = estruturaDe(config)
  if (!andando && nova !== estrutura) setEstrutura(nova)
  // Fica fora do Mostrador (que é recriado a cada mudança de tempo): senão o painel fecharia a cada toque no + ou no −.
  const [configAberta, setConfigAberta] = useState(false)

  // Ao fechar o painel, o foco volta ao botão de ajustes (só depois que o painel saiu da tela e a página deixou de ser inerte).
  const estavaAberta = useRef(false)
  useEffect(() => {
    if (!configAberta && estavaAberta.current) document.getElementById(ID_DO_BOTAO_DE_AJUSTES)?.focus()
    estavaAberta.current = configAberta
  }, [configAberta])

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>

  // Mudar rounds, tempos ou preparo recria o cronômetro (só é possível parado).
  const congelada: ConfigTimer = { ...config, ...(JSON.parse(estrutura) as Pick<ConfigTimer, 'rounds' | 'roundSeg' | 'descansoSeg' | 'preparo'>) }
  return (
    <>
      <Mostrador key={`${estrutura}:${reinicios}`} config={congelada} alterar={alterar} reiniciar={() => setReinicios(n => n + 1)} abrirConfig={() => setConfigAberta(true)} />
      {configAberta && (
        <ConfiguracoesDoTimer
          config={config}
          alterar={alterar}
          aoFechar={() => setConfigAberta(false)}
        />
      )}
    </>
  )
}

const ID_DO_BOTAO_DE_AJUSTES = 'botao-ajustes-do-timer'

const estruturaDe = (c: ConfigTimer): string => JSON.stringify({ rounds: c.rounds, roundSeg: c.roundSeg, descansoSeg: c.descansoSeg, preparo: c.preparo })

function Mostrador({ config, alterar, reiniciar, abrirConfig }: { config: ConfigTimer; alterar: (p: Partial<ConfigTimer>) => void; reiniciar: () => void; abrirConfig: () => void }) {
  const { openRegister } = usePainelAcoes()
  const [tipo, setTipo] = useState<RegType>('tec')

  // Mudar volume ou mudo com o timer rodando vale no próximo aviso (os sons são refeitos com o valor novo).
  const sons = useMemo(() => criarSonsDoTimer(() => ({ volume: config.volume, mudo: config.mudo })), [config.volume, config.mudo])

  const c = useCronometro({
    rounds: config.rounds,
    roundSeg: config.roundSeg,
    descansoSeg: config.descansoSeg,
    preparoSeg: config.preparo ? PREPARO_DO_TIMER_SEG : 0,
    sons,
    contagemNoRound: true,
    vibracao: config.vibracao,
  })

  const parado = c.estado === 'pronto'
  const andando = c.estado === 'rodando' || c.estado === 'pausado'
  const fim = c.estado === 'fim'

  // A barra de baixo pergunta antes de sair da tela com o timer contando.
  useEffect(() => {
    definirTimerAndando(andando)
    return () => definirTimerAndando(false)
  }, [andando])

  // Evita perder o treino ao recarregar ou fechar a página.
  useEffect(() => {
    if (!andando) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [andando])

  const visual: FaseVisual = parado ? 'pronto' : fim ? 'fim' : c.fase.tipo
  const roundMostrado = Math.min(config.rounds, Math.max(1, fim ? c.roundsFeitos : c.fase.round))
  // Antes de iniciar, mostra o tempo do round (e não os 10 s do preparo): é o que a pessoa configurou.
  const tempo = parado ? config.roundSeg : c.restante
  const fracao = parado ? 0 : fim ? 1 : Math.min(1, Math.max(0, (c.decorrido - c.fase.inicio) / c.fase.duracao))
  const R = 124
  const CIRC = 2 * Math.PI * R
  const completo = c.roundsFeitos >= config.rounds

  const midia = useSegundoPlano({
    ligado: config.segundoPlano,
    andando,
    tocando: c.estado === 'rodando',
    detalhe: detalheDaMidia(visual, c.estado === 'pausado', roundMostrado, config.rounds),
    pausar: c.pausar,
    retomar: c.retomar,
  })

  const principal = () => {
    if (parado) {
      midia.ligar() // dentro do toque: o iPhone só libera o áudio de dentro de um toque
      c.iniciar()
    }
    else if (c.estado === 'pausado') c.retomar()
    else c.pausar()
  }
  const rotuloPrincipal = parado ? 'INICIAR' : c.estado === 'pausado' ? 'RETOMAR' : 'PAUSAR'
  const iconePrincipal = c.estado === 'rodando' ? 'ph-pause' : 'ph-play'

  const reiniciarComAviso = () => {
    if (andando && !window.confirm(TEXTOS.confirmar.reiniciarTimer)) return
    reiniciar()
  }
  const encerrar = () => { if (window.confirm(TEXTOS.confirmar.encerrarTreino)) c.encerrar() }
  const registrar = () => openRegister({
    tipo,
    rounds: Math.max(1, c.roundsFeitos),
    minPorRound: minutosDoRound(config.roundSeg),
    duracaoSegundos: Math.max(1, Math.round(c.decorridoReal)),
  })

  const alternarSom = () => alterar({ mudo: !config.mudo })

  return (
    <main className={`${estilos.tela} ${estilos[visual]}`} data-fase={visual}>
      <div className="sr-only" role="status" aria-live="polite">
        {c.estado === 'pausado' ? 'Timer pausado' : parado ? '' : fim ? 'Fim do treino' : c.fase.tipo === 'round' ? `Round ${c.fase.round} começou` : c.fase.tipo === 'descanso' ? 'Descanso' : 'Preparação'}
      </div>

      <div className={estilos.conteudo}>
        <header className={estilos.topo}>
          <div>
            <h1 className={estilos.titulo}>Timer</h1>
            <p className={estilos.resumoTopo}>
              {config.rounds} × {formatarTempo(config.roundSeg)} · {config.descansoSeg > 0 ? `descanso ${rotuloDoDescanso(config.descansoSeg)}` : 'sem descanso'} · {formatarTempo(duracaoTotal(config))} no total
            </p>
          </div>
          <div className={estilos.iconesTopo}>
            <button type="button" className={estilos.icone} onClick={alternarSom} aria-pressed={config.mudo} aria-label="Mudo">
              <i className={`ph-bold ${config.mudo ? 'ph-speaker-slash' : 'ph-speaker-high'}`} aria-hidden="true" />
            </button>
          </div>
        </header>

        {fim ? (
          <section className={estilos.resumo} aria-label="Resumo do treino">
            <div className={estilos.resumoIcone} aria-hidden="true"><i className={`ph-fill ${completo ? 'ph-check' : 'ph-flag'}`} /></div>
            <p className={estilos.rotulo}>{rotuloDaFase('fim')}</p>
            <h2 className={estilos.resumoTitulo}>{completo ? 'Treino concluído!' : 'Treino encerrado'}</h2>
            <dl className={estilos.numeros}>
              <div><dt>Rounds feitos</dt><dd>{c.roundsFeitos}/{config.rounds}</dd></div>
              <div><dt>Tempo total</dt><dd>{formatarTempo(c.decorridoReal)}</dd></div>
            </dl>

            {c.roundsFeitos > 0 ? (
              <>
                <div className={estilos.tipo}>
                  <p>Que tipo de treino foi?</p>
                  <Segmentos rotulo="Tipo de treino" valor={tipo} opcoes={TIPOS.map(t => ({ id: t, label: CAT_LABELS[t] }))} onChange={setTipo} />
                </div>
                <button type="button" className={estilos.botaoPrincipal} onClick={registrar}>
                  <i className="ph-bold ph-plus" aria-hidden="true" /> Registrar este treino
                </button>
              </>
            ) : (
              <p className={estilos.nota}>Nenhum round foi completo, então não há nada para registrar.</p>
            )}
            <button type="button" className={estilos.botaoSecundario} onClick={reiniciar}>Fechar</button>
          </section>
        ) : (
          <>
            <div className={estilos.centro}>
              <p className={estilos.numeroDoRound} aria-label={`Round ${roundMostrado} de ${config.rounds}`}>Round {roundMostrado} / {config.rounds}</p>
              <p className={estilos.rotulo}>{c.estado === 'pausado' ? 'PAUSADO' : rotuloDaFase(visual)}</p>
              <div className={estilos.anel}>
                <svg viewBox="0 0 280 280" aria-hidden="true">
                  <circle cx="140" cy="140" r={R} className={estilos.anelFundo} />
                  <circle cx="140" cy="140" r={R} className={estilos.anelProgresso} strokeDasharray={CIRC} strokeDashoffset={CIRC * fracao} transform="rotate(-90 140 140)" />
                </svg>
                <p className={estilos.tempo} role="timer" aria-label={`Tempo restante ${formatarTempo(tempo)}`}>{formatarTempo(tempo)}</p>
              </div>
              {c.fase.tipo === 'round' && andando && c.restante <= 10 && c.fase.duracao > 25 && <p className={estilos.aviso}><i className="ph-fill ph-bell-ringing" aria-hidden="true" /> Últimos segundos: dê tudo</p>}
              {c.fase.tipo === 'descanso' && andando && <p className={estilos.aviso}><i className="ph-fill ph-drop" aria-hidden="true" /> Respire fundo e beba água. Próximo: round {Math.min(config.rounds, c.fase.round + 1)}</p>}
            </div>

            <div className={estilos.controles}>
              <button type="button" className={estilos.lateral} onClick={reiniciarComAviso} disabled={parado} aria-label="Reiniciar">
                <i className="ph-bold ph-arrow-counter-clockwise" aria-hidden="true" /><span>Reiniciar</span>
              </button>
              <button type="button" className={estilos.principal} onClick={principal}>
                <i className={`ph-fill ${iconePrincipal}`} aria-hidden="true" /> {rotuloPrincipal}
              </button>
              <button
                type="button"
                id={ID_DO_BOTAO_DE_AJUSTES}
                className={estilos.lateral}
                onClick={abrirConfig}
                disabled={andando}
                aria-label="Ajustes"
              >
                <i className="ph-bold ph-gear" aria-hidden="true" /><span>Ajustes</span>
              </button>
            </div>

            {andando
              ? <button type="button" className={estilos.encerrar} onClick={encerrar}>Encerrar e ver o resumo</button>
              : <p className={estilos.nota}>{config.segundoPlano
                ? 'Mantenha o app aberto: a tela fica acesa durante o treino. O som segue com a tela bloqueada (opção ligada nos Ajustes).'
                : 'Mantenha o app aberto: a tela fica acesa durante o treino. Com a tela bloqueada ou em outro app o sino pode falhar: ligue "Manter o som com a tela bloqueada" nos Ajustes.'}</p>}
          </>
        )}
      </div>
    </main>
  )
}

'use client'

import { useEffect, useMemo } from 'react'
import { useHidratado } from '@/hooks/useEntidade'
import { useAssinatura } from '@/hooks/useAssinatura'
import { useHistorico } from '@/hooks/useHistorico'
import { useSessaoDeHoje } from '@/hooks/usePlano'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useRepositorio } from '@/hooks/useRepositorio'
import { chaveDia } from '@/lib/datas'
import { notificar } from '@/lib/notificar'

/**
 * Lembrete diário: só dispara com o app aberto (lembretes com o app fechado exigem um servidor de push).
 * Não desenha nada; fica montado enquanto o app está aberto.
 */
export default function LembreteDiario() {
  const repo = useRepositorio()
  const pronto = useHidratado()
  const { config } = usePreferencias()
  const { historico } = useHistorico()
  const sessaoHoje = useSessaoDeHoje()
  const { podeUsar } = useAssinatura()
  const lembreteLiberado = podeUsar('lembrete')

  const tituloSessaoHoje = sessaoHoje && sessaoHoje.status !== 'feita' ? sessaoHoje.sessao.titulo : null
  const treinouHoje = useMemo(() => {
    if (!pronto) return false
    const hoje = chaveDia(new Date())
    return historico.some(t => chaveDia(new Date(t.data)) === hoje)
  }, [pronto, historico])

  useEffect(() => {
    if (!pronto || !lembreteLiberado || !config.notificacoes || !config.lembreteHora) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const [h, m] = config.lembreteHora.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return

    const verificar = () => {
      const agora = new Date()
      const hojeChave = chaveDia(agora)
      if (agora < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m) || treinouHoje) return
      if (repo.obter('lembrete') === hojeChave) return
      repo.gravar('lembrete', hojeChave)
      void notificar('Hora de treinar', tituloSessaoHoje ? `Hoje: ${tituloSessaoHoje}. Abra o Corner e comece o cronômetro.` : 'Que tal um treino hoje? Abra o Corner e registre.')
    }
    verificar()
    const id = window.setInterval(verificar, 30_000)
    return () => window.clearInterval(id)
  }, [pronto, lembreteLiberado, config.notificacoes, config.lembreteHora, treinouHoje, tituloSessaoHoje, repo])

  return null
}

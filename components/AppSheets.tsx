'use client'

import { usePainelEstado } from './PainelProvider'
import Alertas from './sheets/Alertas'
import EscolherPlano from './sheets/EscolherPlano'
import PerfilAtleta from './sheets/PerfilAtleta'
import RegistroConcluido from './sheets/RegistroConcluido'
import RegistroDetalhes from './sheets/RegistroDetalhes'
import RegistroTipo from './sheets/RegistroTipo'

/** Mostra o painel que está aberto (só um por vez). Cada painel mora em `components/sheets/`. */
export default function AppSheets() {
  const { sheet } = usePainelEstado()

  switch (sheet) {
    case 'type': return <RegistroTipo />
    case 'details': return <RegistroDetalhes />
    case 'done': return <RegistroConcluido />
    case 'notif': return <Alertas />
    case 'planos': return <EscolherPlano />
    case 'onboarding': return <PerfilAtleta />
    default: return null
  }
}

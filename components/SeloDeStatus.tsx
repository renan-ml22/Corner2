import { textoDoStatus, type StatusDeTreino } from '@/lib/cornerman/status-treino'
import estilos from './SeloDeStatus.module.css'

/** Status de treino de um aluno: uma bolinha colorida E o texto. A cor sozinha nunca diz o estado. */
export default function SeloDeStatus({ status }: { status: StatusDeTreino }) {
  return (
    <span className={estilos.selo} data-cor={status.cor}>
      <span className={estilos.ponto} aria-hidden="true" />
      {textoDoStatus(status)}
    </span>
  )
}

import { iniciaisDoAtleta, type Atleta } from '@/data/atletas'
import estilos from './AtletaAvatar.module.css'

/** A bolinha com a cor e as iniciais do atleta. O Corner não usa foto: o nome já está escrito ao lado. */
export default function AtletaAvatar({ atleta, grande = false }: { atleta: Atleta; grande?: boolean }) {
  return (
    <span className={`${estilos.bolinha} ${grande ? estilos.grande : ''}`} style={{ background: atleta.corPrimaria }} aria-hidden="true">
      {iniciaisDoAtleta(atleta.nome)}
    </span>
  )
}

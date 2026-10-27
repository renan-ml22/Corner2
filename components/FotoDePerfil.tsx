import { inicialDoNome } from '@/lib/foto'
import estilos from './FotoDePerfil.module.css'

/** O círculo do perfil: a foto, ou a inicial do nome sobre o degradê do Corner quando não há foto. */
export default function FotoDePerfil({ nome, foto, tamanhoRem = 3.7, alt = 'Sua foto de perfil' }: { nome: string; foto: string; tamanhoRem?: number; alt?: string }) {
  const medida = { width: `${tamanhoRem}rem`, height: `${tamanhoRem}rem` }
  if (foto) {
    // Foto já reduzida a 200×200 e guardada como `data:`: o otimizador do next/image não tem o que melhorar aqui.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={estilos.foto} style={medida} src={foto} width={200} height={200} alt={alt} />
  }
  return <div className={estilos.inicial} style={{ ...medida, fontSize: `${tamanhoRem * 0.35}rem` }} aria-hidden="true">{inicialDoNome(nome)}</div>
}

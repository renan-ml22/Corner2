'use client'

import type { ChangeEvent } from 'react'
import { useFoto } from '@/hooks/useFoto'
import { useToast } from '@/hooks/useToast'
import { prepararFoto } from '@/lib/foto'
import { TEXTOS } from '@/lib/textos'
import FotoDePerfil from './FotoDePerfil'
import estilos from './CabecalhoDoPerfil.module.css'

const AVISO_DO_ERRO = {
  nao_e_imagem: TEXTOS.aviso.fotoNaoEImagem,
  muito_grande: TEXTOS.aviso.fotoGrande,
  ilegivel: TEXTOS.aviso.fotoIlegivel,
} as const

/** Cartão do topo do Perfil: foto (ou inicial), nome, e-mail e os botões para trocar ou tirar a foto. */
export default function CabecalhoDoPerfil({ nome, email }: { nome: string; email: string }) {
  const [foto, definirFoto] = useFoto()
  const avisar = useToast()

  const escolher = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!arquivo) return
    const r = await prepararFoto(arquivo)
    if (r.ok) {
      definirFoto(r.foto)
      avisar(TEXTOS.aviso.fotoSalva)
    } else {
      avisar(AVISO_DO_ERRO[r.erro]) // a foto anterior continua como estava
    }
  }

  const remover = () => {
    definirFoto('')
    avisar(TEXTOS.aviso.fotoRemovida)
  }

  return (
    <section className={`surface-card ${estilos.cabecalho}`}>
      <FotoDePerfil nome={nome} foto={foto} />
      <div className={estilos.dados}>
        <h2>{nome}</h2>
        <p>{email}</p>
        <div className={estilos.acoes}>
          <label className={`btn-ghost small ${estilos.escolher}`}>
            <i className="ph-bold ph-camera" aria-hidden="true" />
            {foto ? 'Trocar foto' : 'Adicionar foto'}
            <input type="file" accept="image/*" className="sr-only" onChange={e => void escolher(e)} />
          </label>
          {foto && (
            <button type="button" className="btn-ghost small" onClick={remover}>
              <i className="ph-bold ph-trash" aria-hidden="true" /> Remover foto
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

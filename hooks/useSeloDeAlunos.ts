'use client'

import { useEffect, useState } from 'react'
import { seloDeAlunosNoServidor } from '@/lib/cornerman/cliente'

/**
 * Quantos alunos com conta estão há 7 dias ou mais sem treinar (o selo da aba "Alunos"). Só consulta o servidor quando o
 * plano do treinador libera a área (`ativo`) e de novo a cada troca de tela, para o número acompanhar o que ele acabou de ver.
 * Qualquer falha (rede, servidor, sem banco) = sem selo: a barra nunca mostra erro por isso.
 */
export function useSeloDeAlunos(ativo: boolean, caminho: string): number {
  const [parados, setParados] = useState(0)

  useEffect(() => {
    if (!ativo) return
    let vivo = true
    void seloDeAlunosNoServidor().then(r => {
      if (vivo) setParados(r.ok ? (r.valor ?? 0) : 0)
    })
    return () => { vivo = false }
  }, [ativo, caminho])

  return ativo ? parados : 0
}

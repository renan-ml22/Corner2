'use client'

import { useCallback, useEffect, useState } from 'react'
import { sugestaoDoTreinadorNoServidor } from '@/lib/cornerman/cliente'
import type { SugestoesDoAluno } from '@/lib/cornerman/sugestao'

const SEM_SUGESTAO: SugestoesDoAluno = { pendente: null, aceita: null }

/**
 * A sugestão de plano do treinador para esta conta, vinda do servidor: a que espera resposta (`pendente`) e a última aceita
 * (`aceita`, para o selo no plano). Falha de rede ou de servidor = nenhuma sugestão: a tela Hoje nunca mostra erro por isso.
 * `respondida` atualiza a tela na hora, depois que o servidor confirmou a resposta.
 */
export function useSugestaoDoTreinador() {
  const [estado, setEstado] = useState<SugestoesDoAluno>(SEM_SUGESTAO)

  useEffect(() => {
    let ativo = true
    void sugestaoDoTreinadorNoServidor().then(r => {
      if (ativo && r.ok) setEstado(r.valor)
    })
    return () => { ativo = false }
  }, [])

  const respondida = useCallback((resposta: 'aceita' | 'recusada') => {
    setEstado(atual => ({
      pendente: null,
      aceita: resposta === 'aceita' && atual.pendente ? { ...atual.pendente, respondidaEm: new Date().toISOString() } : atual.aceita,
    }))
  }, [])

  return { ...estado, respondida }
}

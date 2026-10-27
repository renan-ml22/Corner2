'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExigePlano } from '@/components/ConviteAoPlano'
import FormularioDeAluno from '@/components/FormularioDeAluno'
import { useToast } from '@/hooks/useToast'
import { criarAlunoNoServidor } from '@/lib/cornerman/cliente'
import type { DadosDaFicha } from '@/lib/cornerman/ficha'
import { TEXTOS } from '@/lib/textos'

export default function NovoAlunoCliente() {
  const router = useRouter()
  const avisar = useToast()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const cadastrar = async (dados: DadosDaFicha) => {
    setErro(null)
    setOcupado(true)
    const r = await criarAlunoNoServidor(dados)
    if (r.ok) {
      avisar(TEXTOS.aviso.alunoCadastrado)
      router.push('/alunos') // fica ocupado até a página trocar: nada de segundo clique
      return
    }
    setErro(r.erro)
    setOcupado(false)
  }

  return (
    <main className="page-container">
      <header>
        <Link href="/alunos" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Meus alunos</Link>
        <p className="eyebrow mt-18">Treinador</p>
        <h1 className="page-title">Novo aluno</h1>
      </header>
      <ExigePlano recurso="gestaoDeAlunos">
        <div className="mt-18">
          <FormularioDeAluno rotuloDoBotao="Cadastrar" aoEnviar={dados => void cadastrar(dados)} ocupado={ocupado} erro={erro} />
        </div>
      </ExigePlano>
    </main>
  )
}

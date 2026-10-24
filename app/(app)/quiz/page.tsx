import type { Metadata } from 'next'
import { respostasDaUrl } from '@/lib/quiz'
import QuizCliente from './QuizCliente'

export const metadata: Metadata = { title: 'Quiz de estilo · Corner' }

export default async function QuizPage({ searchParams }: PageProps<'/quiz'>) {
  const { r } = await searchParams
  const respostas = respostasDaUrl(r)
  // Com a chave, ir de /quiz?r=… para /quiz (refazer) recomeça do zero em vez de manter o estado antigo.
  return <QuizCliente key={respostas ? 'resultado' : 'perguntas'} respostasIniciais={respostas} />
}

import Link from 'next/link'

/** Os dois atalhos gratuitos para a biblioteca de exercícios e o quiz de estilo (Hoje e Plano). Na Hoje o quiz tem convite próprio, no topo. */
export default function AtalhosDeEstilo({ semQuiz = false }: { semQuiz?: boolean }) {
  return (
    <>
      <Link href="/exercicios" className="surface-card cta-card">
        <i className="ph-fill ph-boxing-glove" aria-hidden="true" />
        <span><strong>Exercícios</strong><small>20 exercícios com dicas e erros comuns</small></span>
        <i className="ph-bold ph-caret-right" aria-hidden="true" />
      </Link>
      {!semQuiz && (
        <Link href="/quiz" className="surface-card cta-card">
          <i className="ph-fill ph-trophy" aria-hidden="true" />
          <span><strong>Quiz de estilo</strong><small>Descubra com qual atleta você mais se parece</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </Link>
      )}
    </>
  )
}

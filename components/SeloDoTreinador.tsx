import estilos from './SeloDoTreinador.module.css'

/** "Sugerido pelo seu treinador [Nome]": vai junto do nome do plano que o treinador sugeriu e o aluno aceitou. */
export default function SeloDoTreinador({ nome }: { nome: string }) {
  return (
    <span className={estilos.selo}>
      <i className="ph-fill ph-users-three" aria-hidden="true" />
      Sugerido pelo seu treinador {nome}
    </span>
  )
}

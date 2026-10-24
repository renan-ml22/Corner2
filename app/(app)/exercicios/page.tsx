import type { Metadata } from 'next'
import ExerciciosCliente from './ExerciciosCliente'

export const metadata: Metadata = { title: 'Exercícios · Corner' }

export default function ExerciciosPage() {
  return <ExerciciosCliente />
}

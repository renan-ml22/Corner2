import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { atletaPorId } from '@/data/atletas'
import AtletaCliente from './AtletaCliente'

export async function generateMetadata({ params }: PageProps<'/atletas/[id]'>): Promise<Metadata> {
  const { id } = await params
  const atleta = atletaPorId(id)
  return { title: atleta ? `${atleta.nome} · Corner` : 'Atleta · Corner' }
}

export default async function AtletaPage({ params }: PageProps<'/atletas/[id]'>) {
  const { id } = await params
  const atleta = atletaPorId(id)
  if (!atleta) notFound()
  return <AtletaCliente atleta={atleta} />
}

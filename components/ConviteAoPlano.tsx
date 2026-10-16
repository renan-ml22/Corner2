'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { NOME_DO_ACESSO, recurso, type RecursoId } from '@/lib/assinatura/catalogo'
import { useAcesso } from '@/hooks/useAssinatura'
import estilos from './ConviteAoPlano.module.css'

/** Aviso no lugar de um recurso que o plano da pessoa não inclui, com o caminho para assinar. */
export function ConviteAoPlano({ recurso: id, compacto = false }: { recurso: RecursoId; compacto?: boolean }) {
  const nivel = recurso(id).nivelMinimo
  const nome = NOME_DO_ACESSO[nivel]
  return (
    <section className={`surface-card ${estilos.cartao} ${compacto ? estilos.compacto : ''}`} aria-label={`Recurso do plano ${nome}`}>
      <span className={estilos.icone} aria-hidden="true"><i className="ph-fill ph-lock-simple" /></span>
      <div>
        <p className={estilos.titulo}>Disponível a partir do plano {nome}</p>
        <p className={estilos.texto}>{recurso(id).nome}</p>
      </div>
      <Link href="/assinatura" className={`btn-primary ${estilos.acao}`}>Ver planos</Link>
    </section>
  )
}

/**
 * Mostra o conteúdo se o plano da pessoa libera o recurso; senão, o convite para assinar.
 * Enquanto ainda não sabemos, não mostra nem um nem outro (evita piscar "bloqueado").
 */
export function ExigePlano({ recurso: id, children, compacto = false }: { recurso: RecursoId; children: ReactNode; compacto?: boolean }) {
  const { liberado, pronto } = useAcesso(id)
  if (!pronto) return compacto ? null : <div className={`skeleton ${estilos.esqueleto}`} aria-busy="true" />
  return liberado ? <>{children}</> : <ConviteAoPlano recurso={id} compacto={compacto} />
}

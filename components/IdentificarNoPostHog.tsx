'use client'

import { useEffect } from 'react'
import { identificarUsuario } from '@/lib/posthog'

/** Depois do login, liga as métricas à pessoa pelo id dela (o uuid do Supabase). Nunca o e-mail nem o nome. */
export default function IdentificarNoPostHog({ usuarioId }: { usuarioId: string }) {
  useEffect(() => { identificarUsuario(usuarioId) }, [usuarioId])
  return null
}

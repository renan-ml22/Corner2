'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { criarContaAction } from '@/app/actions/onboarding'
import { track } from '@/lib/posthog'
import styles from '@/app/(auth)/login/login.module.css'

/** Tela 1 do onboarding: nome, e-mail e senha. Usa o mesmo visual dos campos do login. */
export default function CadastroForm() {
  const [state, action, pending] = useActionState(criarContaAction, undefined)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const erros = state?.erros ?? {}

  // "Abriu o onboarding": uma vez por visita (o ref evita a contagem dupla do modo de desenvolvimento do React).
  const avisado = useRef(false)
  useEffect(() => {
    if (avisado.current) return
    avisado.current = true
    track('onboarding_started', {})
  }, [])

  const dados = (campo: 'nome' | 'email' | 'senha') => ({
    'aria-invalid': erros[campo] ? true : undefined,
    'aria-describedby': erros[campo] ? `erro-${campo}` : campo === 'senha' ? 'ajuda-senha' : undefined,
  })

  return (
    <form action={action} className={styles.form} noValidate>
      <div className={styles.field}>
        <i className={`ph ph-user ${styles.fieldIcon}`} aria-hidden="true" />
        <input id="nome" name="nome" type="text" autoComplete="name" placeholder=" " defaultValue={state?.nome} required className={styles.input} {...dados('nome')} />
        <label htmlFor="nome" className={styles.label}>Nome completo</label>
      </div>
      {erros.nome && <p id="erro-nome" role="alert" className={styles.error}><i className="ph-fill ph-warning-circle" aria-hidden="true" /> {erros.nome}</p>}

      <div className={styles.field}>
        <i className={`ph ph-envelope-simple ${styles.fieldIcon}`} aria-hidden="true" />
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder=" " defaultValue={state?.email} required className={styles.input} {...dados('email')} />
        <label htmlFor="email" className={styles.label}>E-mail</label>
      </div>
      {erros.email && <p id="erro-email" role="alert" className={styles.error}><i className="ph-fill ph-warning-circle" aria-hidden="true" /> {erros.email}</p>}

      <div className={styles.field}>
        <i className={`ph ph-lock-simple ${styles.fieldIcon}`} aria-hidden="true" />
        <input id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" placeholder=" " required className={styles.input} {...dados('senha')} />
        <label htmlFor="senha" className={styles.label}>Senha</label>
        <button type="button" className={styles.reveal} onClick={() => setMostrarSenha(v => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha}>
          <i className={`ph ${mostrarSenha ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" />
        </button>
      </div>
      {erros.senha
        ? <p id="erro-senha" role="alert" className={styles.error}><i className="ph-fill ph-warning-circle" aria-hidden="true" /> {erros.senha}</p>
        : <p id="ajuda-senha" className={styles.ajuda}>Use pelo menos 8 caracteres.</p>}

      {state?.erro && (
        <p key={state.at} role="alert" className={styles.error}><i className="ph-fill ph-warning-circle" aria-hidden="true" /> {state.erro}</p>
      )}

      <button type="submit" className={styles.submit} disabled={pending} aria-busy={pending}>
        {pending
          ? <><span className={styles.spinner} aria-hidden="true" /> Criando conta…</>
          : <>Continuar <i className="ph-bold ph-arrow-right" aria-hidden="true" /></>}
      </button>
    </form>
  )
}

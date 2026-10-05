'use client'

import { useActionState, useState } from 'react'
import { login } from '@/app/actions/auth'
import styles from './login.module.css'

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'))
  }

  return (
    <form action={action} className={styles.form} noValidate>
      <div className={styles.field}>
        <i className={`ph ph-envelope-simple ${styles.fieldIcon}`} aria-hidden="true" />
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder=" "
          defaultValue={state?.email}
          required
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? 'login-error' : undefined}
          className={styles.input}
        />
        <label htmlFor="email" className={styles.label}>E-mail</label>
      </div>

      <div className={styles.field}>
        <i className={`ph ph-lock-simple ${styles.fieldIcon}`} aria-hidden="true" />
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder=" "
          required
          onKeyDown={onPasswordKey}
          onKeyUp={onPasswordKey}
          onBlur={() => setCapsLock(false)}
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? 'login-error' : undefined}
          className={styles.input}
        />
        <label htmlFor="password" className={styles.label}>Senha</label>
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setShowPassword(v => !v)}
          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={showPassword}
        >
          <i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" />
        </button>
      </div>

      {capsLock && (
        <p className={styles.hint}><i className="ph-bold ph-arrow-fat-up" aria-hidden="true" /> Caps Lock está ativado</p>
      )}

      {state?.error && (
        <p key={state.at} id="login-error" role="alert" className={styles.error}>
          <i className="ph-fill ph-warning-circle" aria-hidden="true" /> {state.error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={pending} aria-busy={pending}>
        {pending ? (
          <><span className={styles.spinner} aria-hidden="true" /> Entrando…</>
        ) : (
          <>Entrar <i className="ph-bold ph-arrow-right" aria-hidden="true" /></>
        )}
      </button>
    </form>
  )
}

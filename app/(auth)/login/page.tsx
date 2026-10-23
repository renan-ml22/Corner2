import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import CornerLogo from '@/components/CornerLogo'
import { getSupabase } from '@/lib/supabase'
import LoginForm from './LoginForm'
import styles from './login.module.css'

export const metadata: Metadata = {
  title: 'Entrar · Corner',
}

export default async function LoginPage() {
  // O link "Criar conta" depende de o Supabase estar configurado: lê o ambiente a cada visita, e não só no build.
  await connection()
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={`${styles.blob} ${styles.blobRed}`} />
        <span className={`${styles.blob} ${styles.blobBlue}`} />
        <svg className={styles.ropes} viewBox="0 0 400 400" preserveAspectRatio="xMaxYMax slice">
          <path d="M400 120 H120 V400" />
          <path d="M400 160 H160 V400" />
          <path d="M400 200 H200 V400" />
        </svg>
        <span className={styles.grain} />
      </div>

      <div className={styles.shell}>
        <section className={styles.brand}>
          <CornerLogo size={112} animated />
          <h1 className={styles.wordmark}>Corner</h1>
          <p className={styles.tagline}>Seu treino de boxe, planejado entre um round e outro.</p>
          <div className={styles.corners}>
            <span><i className={styles.dotRed} />Corner vermelho</span>
            <span><i className={styles.dotBlue} />Corner azul</span>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="login-title">
          <h2 id="login-title" className={styles.title}>Entrar</h2>
          <p className={styles.subtitle}>Bem-vindo de volta ao seu corner.</p>
          <LoginForm />
          {getSupabase() && (
            <p className={styles.alternativa}>
              Ainda não tem conta? <Link href="/onboarding" className={styles.link}>Criar conta</Link>
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

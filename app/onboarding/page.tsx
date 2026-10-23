import type { Metadata } from 'next'
import Link from 'next/link'
import CornerLogo from '@/components/CornerLogo'
import styles from '@/app/(auth)/login/login.module.css'
import CadastroForm from './CadastroForm'

export const metadata: Metadata = {
  title: 'Criar conta · Corner',
}

/** Primeiro passo do onboarding (público): cria a conta. Quem já está logado é levado para /hoje pelo proxy. */
export default function CadastroPage() {
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
        </section>

        <section className={styles.card} aria-labelledby="cadastro-title">
          <h2 id="cadastro-title" className={styles.title}>Crie a sua conta</h2>
          <p className={styles.subtitle}>Leva menos de um minuto. Depois montamos o seu plano de treino.</p>
          <CadastroForm />
          <p className={styles.alternativa}>
            Já tem conta? <Link href="/login" className={styles.link}>Entrar</Link>
          </p>
        </section>
      </div>
    </main>
  )
}

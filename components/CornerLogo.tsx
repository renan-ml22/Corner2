import styles from './CornerLogo.module.css'

const RED = 'oklch(0.63 0.21 25)'
const BLUE = 'oklch(0.62 0.17 258)'

// Logo do Corner: o canto do ringue (poste vermelho + três cordas) com a luva.
// `animated` desenha as cordas e faz a luva "entrar" ao montar o componente.
export default function CornerLogo({ size = 148, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <div
      className={`${styles.mark} ${animated ? styles.animated : ''}`}
      style={{ width: size, height: size, borderRadius: size * 0.243 }}
      role="img"
      aria-label="Corner"
    >
      <svg viewBox="0 0 120 120" className={styles.svg} aria-hidden="true">
        <path className={styles.rope} style={{ animationDelay: '0.05s' }} pathLength={1} d="M120 24 H24 V120" fill="none" stroke={RED} strokeWidth="5" strokeLinecap="round" />
        <path className={styles.rope} style={{ animationDelay: '0.18s' }} pathLength={1} d="M120 36 H36 V120" fill="none" stroke="#e9e9ed" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" />
        <path className={styles.rope} style={{ animationDelay: '0.31s' }} pathLength={1} d="M120 48 H48 V120" fill="none" stroke={BLUE} strokeWidth="5" strokeLinecap="round" />
        <circle className={styles.post} cx="24" cy="24" r="11" fill={RED} />
        <circle className={styles.post} cx="24" cy="24" r="4" fill="#161826" />
      </svg>
      <i
        className={`ph-fill ph-boxing-glove ${styles.glove}`}
        style={{ left: size * 0.453, top: size * 0.439, fontSize: size * 0.432 }}
        aria-hidden="true"
      />
    </div>
  )
}

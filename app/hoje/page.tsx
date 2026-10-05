import ChecklistCard from "@/components/ChecklistCard";
import StreakCard from "@/components/StreakCard";

export default function HojePage() {
  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Terca-feira, 22 de setembro</p>
        <h1 className="page-title">Bom treino, Renan.</h1>
      </header>

      <div className="section-heading">
        <h2>Sua semana</h2>
        <span>Setembro 2026</span>
      </div>
      <StreakCard />

      <div className="section-heading">
        <h2>Treino de hoje</h2>
        <span>2 de 4 feitos</span>
      </div>
      <ChecklistCard />
    </main>
  );
}
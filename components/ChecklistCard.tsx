const exercises = [
  { name: "Mobilidade e ativacao", detail: "5 min", checked: true },
  { name: "Agachamento goblet", detail: "4 x 10", checked: true },
  { name: "Remada unilateral", detail: "3 x 12", checked: false },
  { name: "Prancha", detail: "3 x 40s", checked: false },
];

export default function ChecklistCard() {
  return (
    <section className="surface-card checklist-card" aria-label="Checklist do treino">
      <div className="checklist-header">
        <div className="checklist-title">
          <div className="checklist-icon" aria-hidden="true">↗</div>
          <div>
            <h3>Forca e estabilidade</h3>
            <p>Treino de hoje · 32 min</p>
          </div>
        </div>
        <span className="checklist-count">2/4</span>
      </div>
      <ul className="checklist-items">
        {exercises.map((exercise) => (
          <li key={exercise.name}>
            <label className="checklist-item">
              <input type="checkbox" defaultChecked={exercise.checked} />
              <span>{exercise.name}</span>
              <span>{exercise.detail}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
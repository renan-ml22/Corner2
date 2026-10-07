interface ChecklistItem {
  id: string;
  label: string;
}

interface ChecklistCardProps {
  titulo: string;
  subtitulo: string;
  icone: string;
  itens: ChecklistItem[];
  marcados: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export default function ChecklistCard({ titulo, subtitulo, icone, itens, marcados, onToggle }: ChecklistCardProps) {
  const feitos = itens.filter(i => marcados[i.id]).length;

  return (
    <section className="surface-card checklist-card" aria-label={`Checklist: ${titulo}`}>
      <div className="checklist-header">
        <div className="checklist-title">
          <div className="checklist-icon" aria-hidden="true"><i className={`ph-fill ${icone}`} /></div>
          <div>
            <h3>{titulo}</h3>
            <p>{subtitulo}</p>
          </div>
        </div>
        <span className="checklist-count">{feitos}/{itens.length}</span>
      </div>
      <ul className="checklist-items">
        {itens.map(item => (
          <li key={item.id}>
            <label className="checklist-item">
              <input type="checkbox" checked={!!marcados[item.id]} onChange={() => onToggle(item.id)} />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

import estilos from './ChecklistCard.module.css'

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
    <section className={`surface-card ${estilos.checklistCard}`} aria-label={`Checklist: ${titulo}`}>
      <div className={estilos.checklistHeader}>
        <div className={estilos.checklistTitle}>
          <div className={estilos.checklistIcon} aria-hidden="true"><i className={`ph-fill ${icone}`} /></div>
          <div>
            <h3>{titulo}</h3>
            <p>{subtitulo}</p>
          </div>
        </div>
        <span className={estilos.checklistCount}>{feitos}/{itens.length}</span>
      </div>
      <ul className={estilos.checklistItems}>
        {itens.map(item => (
          <li key={item.id}>
            <label className={estilos.checklistItem}>
              <input type="checkbox" checked={!!marcados[item.id]} onChange={() => onToggle(item.id)} />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

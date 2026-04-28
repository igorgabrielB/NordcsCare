import { School, Clock } from 'lucide-react';
import './Widgets.css';

interface EscolaHoje {
  escola: string;
  hora: string;
  turno?: string;
}

interface SchoolsWidgetProps {
  title: string;
  data: EscolaHoje[];
  isLoading?: boolean;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  '#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#38bdf8','#c084fc','#fb923c',
];

export default function SchoolsWidget({ title, data, isLoading }: SchoolsWidgetProps) {
  return (
    <div className="widget-panel widget-schools">
      <div className="widget-panel-header">
        <School size={18} />
        <span>{title}</span>
        {data && data.length > 0 && (
          <span className="schools-count-badge">{data.length}</span>
        )}
      </div>
      <div className="widget-panel-content">
        {isLoading ? (
          <div className="widget-loading">Carregando...</div>
        ) : data && data.length > 0 ? (
          <ul className="schools-list">
            {data.map((escola, index) => (
              <li key={index} className="schools-list-item">
                <div className="schools-avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
                  {initials(escola.escola)}
                </div>
                <span className="schools-name">{escola.escola}</span>
                <span className="schools-time">
                  <Clock size={12} />
                  {escola.hora}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="widget-empty">Nenhuma escola agendada</div>
        )}
      </div>
    </div>
  );
}

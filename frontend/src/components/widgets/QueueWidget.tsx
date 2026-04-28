import { LayoutGrid } from 'lucide-react';
import './Widgets.css';

interface FilaEstacao {
  estacao: string;
  quantidade: number;
}

interface QueueWidgetProps {
  title: string;
  data: FilaEstacao[];
  isLoading?: boolean;
}

const ESTACAO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  acuidade: { label: 'Acuidade',  color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  laudos:   { label: 'Laudos',    color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  oculos:   { label: 'Óculos',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
};

export default function QueueWidget({ title, data, isLoading }: QueueWidgetProps) {
  const total = data?.reduce((s, d) => s + d.quantidade, 0) ?? 0;

  return (
    <div className="widget-panel widget-queue">
      <div className="widget-panel-header">
        <LayoutGrid size={18} />
        <span>{title}</span>
        {total > 0 && <span className="queue-total-badge">{total} total</span>}
      </div>
      <div className="widget-panel-content">
        {isLoading ? (
          <div className="widget-loading">Carregando...</div>
        ) : data && data.length > 0 ? (
          <div className="queue-stations">
            {data.map((item, index) => {
              const cfg = ESTACAO_CONFIG[item.estacao] ?? { label: item.estacao, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' };
              const pct = total > 0 ? (item.quantidade / total) * 100 : 0;
              return (
                <div key={index} className="queue-station-card" style={{ '--qs-color': cfg.color, '--qs-bg': cfg.bg } as React.CSSProperties}>
                  <div className="qs-header">
                    <span className="qs-label">{cfg.label}</span>
                    <span className="qs-count">{item.quantidade}</span>
                  </div>
                  <div className="qs-bar-track">
                    <div className="qs-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="qs-pct">{total > 0 ? `${Math.round(pct)}%` : '—'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="widget-empty">Nenhum paciente na fila</div>
        )}
      </div>
    </div>
  );
}

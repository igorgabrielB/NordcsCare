import { TrendingUp, BarChart2, PieChart } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import './Widgets.css';

interface ChartData {
  name?: string;
  label?: string;
  value?: number;
  count?: number;
}

interface ChartWidgetProps {
  title: string;
  data: ChartData[];
  type: 'line' | 'bar' | 'pie';
  isLoading?: boolean;
}

const CHART_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#c084fc'];

function normalizeData(data: ChartData[]) {
  return (data ?? []).map(d => ({
    name: d.name || d.label || '',
    value: d.value ?? d.count ?? 0,
  }));
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; color?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="chart-tooltip-value" style={{ color: p.color ?? '#a78bfa' }}>
          {p.value}
        </p>
      ))}
    </div>
  );
};

export default function ChartWidget({ title, data, type, isLoading }: ChartWidgetProps) {
  const IconComponent = type === 'line' ? TrendingUp : type === 'bar' ? BarChart2 : PieChart;
  const chartData = normalizeData(data);

  return (
    <div className="widget-panel widget-chart">
      <div className="widget-panel-header">
        <IconComponent size={18} />
        <span>{title}</span>
      </div>
      <div className="widget-panel-content widget-chart-content">
        {isLoading ? (
          <div className="widget-loading">Carregando...</div>
        ) : chartData.length === 0 ? (
          <div className="widget-empty">Sem dados</div>
        ) : type === 'pie' ? (
          <div className="chart-pie-wrapper">
            <ResponsiveContainer width="100%" height={160}>
              <RPieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </RPieChart>
            </ResponsiveContainer>
            <div className="chart-pie-legend">
              {chartData.slice(0, 5).map((item, i) => (
                <div key={i} className="chart-pie-legend-item">
                  <span className="chart-pie-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="chart-pie-name">{item.name}</span>
                  <span className="chart-pie-val">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : type === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(167,139,250,0.08)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#a78bfa"
                strokeWidth={2.5}
                dot={{ fill: '#a78bfa', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#c084fc', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

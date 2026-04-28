import { 
  Users, School, ClipboardList, Stethoscope, CheckCircle, 
  Glasses, ArrowRightLeft, Eye, FileText, Activity, Clock,
  Share2, Hash, Star, TrendingUp, Pill
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './Widgets.css';

interface MetricWidgetProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  isLoading?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  Users, users: Users,
  School, school: School,
  ClipboardList, clipboard: ClipboardList,
  Stethoscope, stethoscope: Stethoscope,
  CheckCircle, check: CheckCircle,
  Glasses, glasses: Glasses,
  ArrowRightLeft, share: Share2,
  Eye, eye: Eye,
  FileText, file: FileText,
  Activity, activity: Activity,
  Clock, clock: Clock,
  Hash, hash: Hash,
  Star, star: Star,
  TrendingUp, trending: TrendingUp,
  pill: Pill, Pill,
};

const COLOR_TOKENS: Record<string, { bg: string; glow: string; text: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  glow: '#3b82f6', text: '#60a5fa' },
  green:  { bg: 'rgba(34,197,94,0.12)',   glow: '#22c55e', text: '#4ade80' },
  orange: { bg: 'rgba(245,158,11,0.12)',  glow: '#f59e0b', text: '#fbbf24' },
  red:    { bg: 'rgba(239,68,68,0.12)',   glow: '#ef4444', text: '#f87171' },
  purple: { bg: 'rgba(168,85,247,0.12)', glow: '#a855f7', text: '#c084fc' },
  teal:   { bg: 'rgba(20,184,166,0.12)', glow: '#14b8a6', text: '#2dd4bf' },
  pink:   { bg: 'rgba(236,72,153,0.12)', glow: '#ec4899', text: '#f472b6' },
};

function resolveColor(color: string) {
  if (COLOR_TOKENS[color]) return COLOR_TOKENS[color];
  // raw hex/css
  return { bg: `${color}20`, glow: color, text: color };
}

export default function MetricWidget({ title, value, icon, color, isLoading }: MetricWidgetProps) {
  const IconComponent = iconMap[icon] ?? iconMap[icon?.toLowerCase()] ?? Activity;
  const tok = resolveColor(color);

  return (
    <div className="widget-metric" style={{ '--wm-glow': tok.glow, '--wm-text': tok.text, '--wm-bg': tok.bg } as React.CSSProperties}>
      <div className="wm-icon-wrap">
        <IconComponent size={22} />
      </div>
      <div className="wm-body">
        <span className="wm-value">
          {isLoading ? <span className="wm-skeleton" /> : value ?? '--'}
        </span>
        <span className="wm-title">{title}</span>
      </div>
      <div className="wm-glow-orb" />
    </div>
  );
}

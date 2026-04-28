import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GridLayout, { type Layout } from 'react-grid-layout';
import { 
  Settings, Save, RotateCcw, Plus, GripVertical, 
  Eye, Trash2, LayoutTemplate, ChevronRight, Sparkles,
  BarChart2, Activity, Clock, CheckCircle2,
  ListChecks, AlertTriangle, ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { MetricWidget, SchoolsWidget, QueueWidget, ChartWidget } from '../../components/widgets';
import './DashboardBuilder.css';

interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  config: Record<string, unknown>;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

interface DashboardLayout {
  widgets: WidgetConfig[];
}

interface AvailableWidget {
  type: string;
  name: string;
  icon: string;
  category: string;
  defaultConfig: Record<string, unknown>;
}

interface Metricas {
  total_matriculados: number;
  pacientes_do_dia: number;
  na_fila: number;
  atendimentos_hoje: number;
  total_altas: number;
  total_prescricoes: number;
  total_encaminhamentos: number;
  total_exames: number;
  total_laudos: number;
  escolas_hoje: { escola: string; hora: string }[];
  proximos_atendimentos: { escola: string; hora: string }[];
  fila_por_estacao: { estacao: string; quantidade: number }[];
  condutas_iniciais: { name: string; value: number }[];
  atendimentos_por_dia: { name: string; value: number }[];
  encaminhamentos_tipo: { name: string; value: number }[];
}

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  tag: string;
  tagColor: string;
  preview: { cols: number; rows: number; blocks: { x: number; y: number; w: number; h: number; color: string }[] };
  widgets: Omit<WidgetConfig, 'i'>[];
}

const WIDGET_ICONS: Record<string, React.ReactNode> = {
  'metric': <Activity size={16} />,
  'schools-today': <CheckCircle2 size={16} />,
  'schools-scheduled': <Clock size={16} />,
  'queue-stations': <ListChecks size={16} />,
  'chart-line': <BarChart2 size={16} />,
  'chart-bar': <BarChart2 size={16} />,
  'chart-pie': <BarChart2 size={16} />,
};

const TEMPLATES: DashboardTemplate[] = [
  { id: 'padrao',
    name: 'Dashboard Padrão',
    description: 'Réplica exata do dashboard original: 7 métricas, escolas, fila por estação, gráfico de atendimentos e condutas.',
    tag: 'Padrão',
    tagColor: 'gray',
    preview: {
      cols: 12, rows: 15,
      blocks: [
        { x: 0, y: 0, w: 3, h: 2, color: 'blue' },
        { x: 3, y: 0, w: 3, h: 2, color: 'green' },
        { x: 6, y: 0, w: 3, h: 2, color: 'orange' },
        { x: 9, y: 0, w: 3, h: 2, color: 'green' },
        { x: 0, y: 2, w: 4, h: 2, color: 'green' },
        { x: 4, y: 2, w: 4, h: 2, color: 'red' },
        { x: 8, y: 2, w: 4, h: 2, color: 'orange' },
        { x: 0, y: 4, w: 6, h: 4, color: 'gray' },
        { x: 6, y: 4, w: 6, h: 4, color: 'gray' },
        { x: 0, y: 8, w: 5, h: 4, color: 'gray' },
        { x: 5, y: 8, w: 7, h: 4, color: 'blue-light' },
        { x: 0, y: 12, w: 12, h: 3, color: 'gray' },
      ]
    },
    widgets: [
      { x:0, y:0, w:3, h:2, type:'metric', config:{ title:'Total Matriculados', metric:'total_matriculados', icon:'users', color:'blue' } },
      { x:3, y:0, w:3, h:2, type:'metric', config:{ title:'Pacientes do Dia', metric:'pacientes_do_dia', icon:'users', color:'green' } },
      { x:6, y:0, w:3, h:2, type:'metric', config:{ title:'Na Fila Agora', metric:'na_fila', icon:'clock', color:'orange' } },
      { x:9, y:0, w:3, h:2, type:'metric', config:{ title:'Atendimentos', metric:'atendimentos_hoje', icon:'check', color:'green' } },
      { x:0, y:2, w:4, h:2, type:'metric', config:{ title:'Altas', metric:'total_altas', icon:'check', color:'green' } },
      { x:4, y:2, w:4, h:2, type:'metric', config:{ title:'Óculos', metric:'total_prescricoes', icon:'glasses', color:'red' } },
      { x:8, y:2, w:4, h:2, type:'metric', config:{ title:'Encaminhamentos', metric:'total_encaminhamentos', icon:'share', color:'orange' } },
      { x:0, y:4, w:6, h:5, type:'schools-today', config:{ title:'Escolas do Dia' } },
      { x:6, y:4, w:6, h:5, type:'schools-scheduled', config:{ title:'Próximos Atendimentos' } },
      { x:0, y:9, w:5, h:5, type:'queue-stations', config:{ title:'Fila por Estação' } },
      { x:5, y:9, w:7, h:5, type:'chart-bar', config:{ title:'Últimos 7 Dias', dataKey:'atendimentos_por_dia' } },
      { x:0, y:14, w:12, h:5, type:'chart-pie', config:{ title:'Condutas', dataKey:'condutas_iniciais' } },
    ]
  },
  {
    id: 'visao-geral',
    name: 'Visão Geral',
    description: 'Métricas principais, fila atual e atendimentos do dia. Ideal para uma visão rápida da clínica.',
    tag: 'Recomendado',
    tagColor: 'green',
    preview: {
      cols: 12, rows: 6,
      blocks: [
        { x: 0, y: 0, w: 3, h: 2, color: 'blue' },
        { x: 3, y: 0, w: 3, h: 2, color: 'purple' },
        { x: 6, y: 0, w: 3, h: 2, color: 'teal' },
        { x: 9, y: 0, w: 3, h: 2, color: 'orange' },
        { x: 0, y: 2, w: 7, h: 4, color: 'blue-light' },
        { x: 7, y: 2, w: 5, h: 4, color: 'gray' },
      ]
    },
    widgets: [
      { x:0, y:0, w:3, h:2, type:'metric', config:{ title:'Pacientes Hoje', metric:'pacientes_do_dia', icon:'users', color:'blue' } },
      { x:3, y:0, w:3, h:2, type:'metric', config:{ title:'Na Fila', metric:'na_fila', icon:'clock', color:'orange' } },
      { x:6, y:0, w:3, h:2, type:'metric', config:{ title:'Atendimentos', metric:'atendimentos_hoje', icon:'check', color:'green' } },
      { x:9, y:0, w:3, h:2, type:'metric', config:{ title:'Matriculados', metric:'total_matriculados', icon:'school', color:'purple' } },
      { x:0, y:2, w:7, h:5, type:'chart-bar', config:{ title:'Atendimentos por Dia', dataKey:'atendimentos_por_dia' } },
      { x:7, y:2, w:5, h:5, type:'queue-stations', config:{ title:'Fila por Estação' } },
    ]
  },
  {
    id: 'foco-fila',
    name: 'Foco na Fila',
    description: 'Prioridade para gestão da fila e agendamentos. Ideal para recepcionistas e coordenadores.',
    tag: 'Operacional',
    tagColor: 'blue',
    preview: {
      cols: 12, rows: 6,
      blocks: [
        { x: 0, y: 0, w: 4, h: 2, color: 'orange' },
        { x: 4, y: 0, w: 4, h: 2, color: 'teal' },
        { x: 8, y: 0, w: 4, h: 2, color: 'green' },
        { x: 0, y: 2, w: 6, h: 4, color: 'gray' },
        { x: 6, y: 2, w: 6, h: 4, color: 'gray' },
      ]
    },
    widgets: [
      { x:0, y:0, w:4, h:2, type:'metric', config:{ title:'Na Fila Agora', metric:'na_fila', icon:'clock', color:'orange' } },
      { x:4, y:0, w:4, h:2, type:'metric', config:{ title:'Atendimentos Hoje', metric:'atendimentos_hoje', icon:'check', color:'green' } },
      { x:8, y:0, w:4, h:2, type:'metric', config:{ title:'Pacientes do Dia', metric:'pacientes_do_dia', icon:'users', color:'blue' } },
      { x:0, y:2, w:6, h:5, type:'queue-stations', config:{ title:'Fila por Estação' } },
      { x:6, y:2, w:6, h:5, type:'schools-today', config:{ title:'Escolas Atendidas Hoje' } },
    ]
  },
  {
    id: 'clinico',
    name: 'Visão Clínica',
    description: 'Foco em dados clínicos: prescrições, encaminhamentos, exames e laudos.',
    tag: 'Clínico',
    tagColor: 'teal',
    preview: {
      cols: 12, rows: 6,
      blocks: [
        { x: 0, y: 0, w: 3, h: 2, color: 'blue' },
        { x: 3, y: 0, w: 3, h: 2, color: 'purple' },
        { x: 6, y: 0, w: 3, h: 2, color: 'teal' },
        { x: 9, y: 0, w: 3, h: 2, color: 'green' },
        { x: 0, y: 2, w: 6, h: 4, color: 'blue-light' },
        { x: 6, y: 2, w: 6, h: 4, color: 'purple-light' },
      ]
    },
    widgets: [
      { x:0, y:0, w:3, h:2, type:'metric', config:{ title:'Prescrições', metric:'total_prescricoes', icon:'pill', color:'blue' } },
      { x:3, y:0, w:3, h:2, type:'metric', config:{ title:'Encaminhamentos', metric:'total_encaminhamentos', icon:'share', color:'purple' } },
      { x:6, y:0, w:3, h:2, type:'metric', config:{ title:'Exames', metric:'total_exames', icon:'microscope', color:'teal' } },
      { x:9, y:0, w:3, h:2, type:'metric', config:{ title:'Laudos', metric:'total_laudos', icon:'file', color:'green' } },
      { x:0, y:2, w:6, h:5, type:'chart-pie', config:{ title:'Condutas Iniciais', dataKey:'condutas_iniciais' } },
      { x:6, y:2, w:6, h:5, type:'chart-bar', config:{ title:'Tipos de Encaminhamento', dataKey:'encaminhamentos_tipo' } },
    ]
  },
  {
    id: 'escolas',
    name: 'Gestão de Escolas',
    description: 'Acompanhamento de visitas e agendamentos por escola. Ideal para coordenadores pedagógicos.',
    tag: 'Escolas',
    tagColor: 'orange',
    preview: {
      cols: 12, rows: 6,
      blocks: [
        { x: 0, y: 0, w: 6, h: 2, color: 'orange' },
        { x: 6, y: 0, w: 6, h: 2, color: 'blue' },
        { x: 0, y: 2, w: 6, h: 4, color: 'gray' },
        { x: 6, y: 2, w: 6, h: 4, color: 'gray' },
      ]
    },
    widgets: [
      { x:0, y:0, w:6, h:2, type:'metric', config:{ title:'Total Matriculados', metric:'total_matriculados', icon:'school', color:'orange' } },
      { x:6, y:0, w:6, h:2, type:'metric', config:{ title:'Atendimentos Hoje', metric:'atendimentos_hoje', icon:'check', color:'green' } },
      { x:0, y:2, w:6, h:6, type:'schools-today', config:{ title:'Escolas Atendidas Hoje' } },
      { x:6, y:2, w:6, h:6, type:'schools-scheduled', config:{ title:'Próximos Agendamentos' } },
    ]
  },
  {
    id: 'simples',
    name: 'Dashboard Simples',
    description: 'Apenas as 4 métricas principais. Limpo e objetivo para visualização rápida.',
    tag: 'Básico',
    tagColor: 'gray',
    preview: {
      cols: 12, rows: 2,
      blocks: [
        { x: 0, y: 0, w: 3, h: 2, color: 'blue' },
        { x: 3, y: 0, w: 3, h: 2, color: 'purple' },
        { x: 6, y: 0, w: 3, h: 2, color: 'green' },
        { x: 9, y: 0, w: 3, h: 2, color: 'orange' },
      ]
    },
    widgets: [
      { x:0, y:0, w:3, h:2, type:'metric', config:{ title:'Pacientes Hoje', metric:'pacientes_do_dia', icon:'users', color:'blue' } },
      { x:3, y:0, w:3, h:2, type:'metric', config:{ title:'Na Fila', metric:'na_fila', icon:'clock', color:'orange' } },
      { x:6, y:0, w:3, h:2, type:'metric', config:{ title:'Atendimentos', metric:'atendimentos_hoje', icon:'check', color:'green' } },
      { x:9, y:0, w:3, h:2, type:'metric', config:{ title:'Matriculados', metric:'total_matriculados', icon:'school', color:'purple' } },
    ]
  },
];

export default function DashboardBuilder() {
  const { hasTela } = useAuth();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<DashboardLayout>({ widgets: [] });
  const [availableWidgets, setAvailableWidgets] = useState<AvailableWidget[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'templates'>('view');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveForTenant, setSaveForTenant] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'widgets' | 'settings'>('widgets');
  const [confirmModal, setConfirmModal] = useState<{ template: DashboardTemplate } | null>(null);

  const isEditing = mode === 'edit';

  // Carregar configuração e métricas
  useEffect(() => {
    const loadData = async () => {
      try {
        const [configRes, widgetsRes, metricasRes] = await Promise.all([
          api.get('/dashboard-config'),
          api.get('/dashboard-config/widgets'),
          api.get('/dashboard/metricas')
        ]);
        
        setLayout(configRes.data.layout || { widgets: [] });
        setAvailableWidgets(widgetsRes.data);
        setMetricas(metricasRes.data);
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Converter widgets para o formato do react-grid-layout
  const getGridLayout = useCallback((): Layout[] => {
    return layout.widgets.map(w => ({
      i: w.i,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: w.minW || 2,
      minH: w.minH || 2,
      isDraggable: isEditing,
      isResizable: isEditing,
    }));
  }, [layout.widgets, isEditing]);

  // Atualizar layout quando arrastar/redimensionar
  const handleLayoutChange = (newLayout: Layout[]) => {
    if (!isEditing) return;
    setLayout(prev => ({
      widgets: prev.widgets.map(widget => {
        const updated = newLayout.find(l => l.i === widget.i);
        if (updated) {
          return { ...widget, x: updated.x, y: updated.y, w: updated.w, h: updated.h };
        }
        return widget;
      })
    }));
    setHasChanges(true);
  };

  // Adicionar novo widget
  const addWidget = (widgetDef: AvailableWidget) => {
    const id = `${widgetDef.type}-${Date.now()}`;
    const newWidget: WidgetConfig = {
      i: id,
      x: 0,
      y: Infinity,
      w: widgetDef.type === 'metric' ? 3 : 6,
      h: widgetDef.type === 'metric' ? 2 : 5,
      type: widgetDef.type,
      config: { ...widgetDef.defaultConfig },
    };
    setLayout(prev => ({ widgets: [...prev.widgets, newWidget] }));
    setHasChanges(true);
  };

  // Remover widget
  const removeWidget = (widgetId: string) => {
    setLayout(prev => ({ widgets: prev.widgets.filter(w => w.i !== widgetId) }));
    setHasChanges(true);
  };

  // Aplicar template
  const applyTemplate = (template: DashboardTemplate) => {
    if (layout.widgets.length > 0) {
      setConfirmModal({ template });
      return;
    }
    confirmApplyTemplate(template);
  };

  const confirmApplyTemplate = (template: DashboardTemplate) => {
    const widgets: WidgetConfig[] = template.widgets.map((w, idx) => ({
      ...w,
      i: `${w.type}-${Date.now()}-${idx}`,
    }));
    setLayout({ widgets });
    setHasChanges(true);
    setConfirmModal(null);
    setMode('edit');
  };

  // Salvar configuração
  const saveLayout = async () => {
    setIsSaving(true);
    try {
      await api.post('/dashboard-config', {
        layout,
        save_for_tenant: saveForTenant
      });
      setHasChanges(false);
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  // Resetar para padrão
  const resetLayout = async () => {
    if (!confirm('Resetar o dashboard para o padrão?')) return;
    try {
      await api.delete('/dashboard-config');
      const configRes = await api.get('/dashboard-config');
      setLayout(configRes.data.layout || { widgets: [] });
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao resetar:', error);
    }
  };

  // Renderizar widget
  const renderWidget = (widget: WidgetConfig) => {
    const config = widget.config;
    switch (widget.type) {
      case 'metric': {
        const metricKey = config.metric as keyof Metricas;
        const metricValue = metricas?.[metricKey];
        return (
          <MetricWidget
            title={config.title as string}
            value={typeof metricValue === 'number' ? metricValue : '--'}
            icon={config.icon as string}
            color={config.color as string}
            isLoading={!metricas}
          />
        );
      }
      case 'schools-today':
        return <SchoolsWidget title={config.title as string} data={metricas?.escolas_hoje || []} isLoading={!metricas} />;
      case 'schools-scheduled':
        return <SchoolsWidget title={config.title as string} data={metricas?.proximos_atendimentos || []} isLoading={!metricas} />;
      case 'queue-stations':
        return <QueueWidget title={config.title as string} data={metricas?.fila_por_estacao || []} isLoading={!metricas} />;
      case 'chart-line':
      case 'chart-bar': {
        const lineData = metricas ? (metricas[config.dataKey as keyof Metricas] as unknown as { name?: string; value?: number }[]) : [];
        return <ChartWidget title={config.title as string} data={lineData || []} type={widget.type === 'chart-line' ? 'line' : 'bar'} isLoading={!metricas} />;
      }
      case 'chart-pie': {
        const pieData = metricas ? (metricas[config.dataKey as keyof Metricas] as unknown as { name?: string; value?: number }[]) : [];
        return <ChartWidget title={config.title as string} data={pieData || []} type="pie" isLoading={!metricas} />;
      }
      default:
        return <div className="widget-unknown">Widget não reconhecido</div>;
    }
  };

  const widgetsByCategory = availableWidgets.reduce((acc, widget) => {
    if (!acc[widget.category]) acc[widget.category] = [];
    acc[widget.category].push(widget);
    return acc;
  }, {} as Record<string, AvailableWidget[]>);

  if (!hasTela('dashboard_builder')) {
    return (
      <div className="builder-access-denied">
        <Settings size={40} />
        <h2>Acesso Restrito</h2>
        <p>Apenas administradores podem personalizar o dashboard.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="builder-loading">
        <div className="builder-loading-spinner" />
        <span>Carregando dashboard...</span>
      </div>
    );
  }

  // ── MODO TEMPLATES ─────────────────────────────────────────────
  if (mode === 'templates') {
    return (
      <div className="dashboard-builder">
        <div className="builder-topbar">
          <div className="builder-topbar-left">
            <button className="builder-back-btn" onClick={() => setMode('view')}>
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              Voltar
            </button>
            <div className="builder-topbar-title">
              <LayoutTemplate size={20} />
              <span>Templates de Dashboard</span>
            </div>
          </div>
        </div>

        <div className="builder-templates-page">
          <div className="builder-templates-header">
            <Sparkles size={28} />
            <div>
              <h1>Escolha um modelo pronto</h1>
              <p>Comece com um template e personalize como quiser</p>
            </div>
          </div>

          <div className="builder-templates-grid">
            {TEMPLATES.map(template => (
              <div key={template.id} className="builder-template-card">
                <div className="builder-template-preview">
                  <TemplatePreview template={template} />
                </div>
                <div className="builder-template-info">
                  <div className="builder-template-header">
                    <h3>{template.name}</h3>
                    <span className={`builder-template-tag tag-${template.tagColor}`}>{template.tag}</span>
                  </div>
                  <p>{template.description}</p>
                  <div className="builder-template-meta">
                    <span>{template.widgets.length} widgets</span>
                  </div>
                  <button className="builder-template-apply-btn" onClick={() => applyTemplate(template)}>
                    Usar este template
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal de confirmação de template */}
        {confirmModal && (
          <div className="builder-confirm-overlay" onClick={() => setConfirmModal(null)}>
            <div className="builder-confirm-modal" onClick={e => e.stopPropagation()}>
              <div className="builder-confirm-icon">
                <AlertTriangle size={26} />
              </div>
              <div className="builder-confirm-body">
                <h3>Substituir dashboard atual?</h3>
                <p>
                  O template <strong>{confirmModal.template.name}</strong> irá substituir todos os widgets do dashboard atual. Essa ação não pode ser desfeita.
                </p>
              </div>
              <div className="builder-confirm-actions">
                <button className="builder-confirm-btn cancel" onClick={() => setConfirmModal(null)}>
                  Cancelar
                </button>
                <button className="builder-confirm-btn confirm" onClick={() => confirmApplyTemplate(confirmModal.template)}>
                  <Sparkles size={15} />
                  Usar template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MODO VIEW / EDIT ────────────────────────────────────────────
  return (
    <div className={`dashboard-builder ${isEditing ? 'builder-editing-mode' : ''}`}>

      {/* Modal de confirmação de template */}
      {confirmModal && (
        <div className="builder-confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className="builder-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="builder-confirm-icon">
              <AlertTriangle size={26} />
            </div>
            <div className="builder-confirm-body">
              <h3>Substituir dashboard atual?</h3>
              <p>
                O template <strong>{confirmModal.template.name}</strong> irá substituir todos os widgets do dashboard atual. Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="builder-confirm-actions">
              <button className="builder-confirm-btn cancel" onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button className="builder-confirm-btn confirm" onClick={() => confirmApplyTemplate(confirmModal.template)}>
                <Sparkles size={15} />
                Usar template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="builder-topbar">
        <div className="builder-topbar-left">
          <button className="builder-topbar-btn ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
            Voltar
          </button>
          <div className="builder-topbar-title">
            <Settings size={20} />
            <span>Personalizar Dashboard</span>
          </div>
          {hasChanges && <span className="builder-unsaved-badge">● Não salvo</span>}
        </div>

        <div className="builder-topbar-actions">
          {isEditing ? (
            <>
              <button className="builder-topbar-btn ghost" onClick={resetLayout}>
                <RotateCcw size={16} />
                Resetar
              </button>
              <div className="builder-divider" />
              <label className="builder-tenant-toggle">
                <input type="checkbox" checked={saveForTenant} onChange={e => setSaveForTenant(e.target.checked)} />
                <span>Salvar para toda a clínica</span>
              </label>
              <button className="builder-topbar-btn outline" onClick={() => setMode('view')}>
                <Eye size={16} />
                Visualizar
              </button>
              <button className="builder-topbar-btn primary" onClick={saveLayout} disabled={isSaving || !hasChanges}>
                <Save size={16} />
                {isSaving ? 'Salvando...' : 'Salvar dashboard'}
              </button>
            </>
          ) : (
            <>
              <button className="builder-topbar-btn ghost" onClick={() => setMode('templates')}>
                <LayoutTemplate size={16} />
                Templates
              </button>
              <button className="builder-topbar-btn primary" onClick={() => setMode('edit')}>
                <Settings size={16} />
                Editar layout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Mode: layout + sidebar */}
      <div className={`builder-body ${isEditing ? 'with-sidebar' : ''}`}>

        {/* Main Grid */}
        <div className="builder-main">
          {layout.widgets.length === 0 ? (
            <div className="builder-empty-state">
              <div className="builder-empty-icon">
                <LayoutTemplate size={40} />
              </div>
              <h2>Dashboard vazio</h2>
              <p>Comece escolhendo um modelo pronto ou adicione widgets manualmente pelo painel lateral.</p>
              <div className="builder-empty-actions">
                <button className="builder-empty-btn primary" onClick={() => setMode('templates')}>
                  <Sparkles size={18} />
                  Ver templates
                </button>
                <button className="builder-empty-btn secondary" onClick={() => setMode('edit')}>
                  <Plus size={18} />
                  Criar do zero
                </button>
              </div>
            </div>
          ) : (
            // @ts-ignore
            <GridLayout
              className="builder-grid"
              layout={getGridLayout()}
              cols={12}
              rowHeight={60}
              width={1200}
              onLayoutChange={(newLayout) => handleLayoutChange(newLayout as Layout[])}
              isDraggable={isEditing}
              isResizable={isEditing}
              compactType="vertical"
              margin={[16, 16]}
              containerPadding={[0, 0]}
              draggableHandle=".widget-drag-handle"
              resizeHandles={['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']}
            >
              {layout.widgets.map(widget => (
                <div key={widget.i} className="builder-widget-wrapper">
                  {isEditing && (
                    <div className="widget-edit-overlay">
                      <div className="widget-edit-hint">
                        <span>Arraste pelos cantos para redimensionar</span>
                      </div>
                      <div className="widget-drag-handle" title="Arrastar">
                        <GripVertical size={15} />
                      </div>
                      <button className="widget-delete-btn" onClick={() => removeWidget(widget.i)} title="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  <div className="builder-widget-content">
                    {renderWidget(widget)}
                  </div>
                </div>
              ))}
            </GridLayout>
          )}
        </div>

        {/* Sidebar (edit mode) */}
        {isEditing && (
          <aside className="builder-sidebar">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${sidebarTab === 'widgets' ? 'active' : ''}`}
                onClick={() => setSidebarTab('widgets')}
              >
                <Plus size={15} />
                Widgets
              </button>
              <button
                className={`sidebar-tab ${sidebarTab === 'settings' ? 'active' : ''}`}
                onClick={() => setSidebarTab('settings')}
              >
                <Settings size={15} />
                Templates
              </button>
            </div>

            {sidebarTab === 'widgets' && (
              <div className="sidebar-content">
                <p className="sidebar-hint">Clique para adicionar ao dashboard</p>
                {Object.entries(widgetsByCategory).map(([category, widgets]) => (
                  <div key={category} className="sidebar-category">
                    <span className="sidebar-category-label">{category}</span>
                    <div className="sidebar-widget-list">
                      {widgets.map((widget, idx) => (
                        <button key={idx} className="sidebar-widget-item" onClick={() => addWidget(widget)}>
                          <span className="sidebar-widget-icon">{WIDGET_ICONS[widget.type] ?? <Activity size={16} />}</span>
                          <span className="sidebar-widget-name">{widget.name}</span>
                          <Plus size={14} className="sidebar-widget-add" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === 'settings' && (
              <div className="sidebar-content">
                <p className="sidebar-hint">Substitua o layout atual por um template</p>
                <div className="sidebar-templates-list">
                  {TEMPLATES.map(template => (
                    <button key={template.id} className="sidebar-template-item" onClick={() => applyTemplate(template)}>
                      <div className="sidebar-template-item-info">
                        <span className="sidebar-template-item-name">{template.name}</span>
                        <span className="sidebar-template-item-desc">{template.widgets.length} widgets</span>
                      </div>
                      <span className={`sidebar-template-tag tag-${template.tagColor}`}>{template.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sidebar-footer">
              <div className="sidebar-footer-info">
                <span>{layout.widgets.length} widget{layout.widgets.length !== 1 ? 's' : ''} no dashboard</span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ── Template Preview Component ──────────────────────────────────
function TemplatePreview({ template }: { template: DashboardTemplate }) {
  const { cols, rows, blocks } = template.preview;
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const colorMap: Record<string, string> = {
    blue: 'var(--primary)',
    purple: '#8b5cf6',
    teal: '#0d9488',
    orange: '#f97316',
    green: '#16a34a',
    'blue-light': 'color-mix(in srgb, var(--primary) 30%, transparent)',
    'purple-light': 'color-mix(in srgb, #8b5cf6 30%, transparent)',
    gray: 'var(--border)',
  };

  return (
    <div className="template-preview-canvas">
      {blocks.map((block, i) => (
        <div
          key={i}
          className="template-preview-block"
          style={{
            left: `${block.x * cellW}%`,
            top: `${block.y * cellH}%`,
            width: `calc(${block.w * cellW}% - 4px)`,
            height: `calc(${block.h * cellH}% - 4px)`,
            background: colorMap[block.color] ?? 'var(--border)',
          }}
        />
      ))}
    </div>
  );
}

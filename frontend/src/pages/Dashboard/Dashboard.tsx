import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import api from '../../services/api.ts'
import { Users, ClipboardList, Stethoscope, Tag, Hash, CalendarDays, Filter, ArrowRightLeft, CheckCircle, Eye, Glasses, Settings } from 'lucide-react'
import './Dashboard.css'
import { MetricWidget, SchoolsWidget, QueueWidget, ChartWidget } from '../../components/widgets'
import TimeWheelPicker from '../../components/TimeWheelPicker/TimeWheelPicker'
import DatePicker from '../../components/DatePicker/DatePicker'

interface Metricas {
  total_matriculados: number
  pacientes_do_dia: number
  escolas_hoje: { escola: string; total: number }[]
  atendimentos_hoje: number
  na_fila: number
  total_exames: number
  total_prescricoes: number
  total_laudos: number
  total_altas: number
  condutas_iniciais: { name: string; value: number }[]
  condutas_finais: { name: string; value: number }[]
  atendimentos_por_dia: { name: string; value: number }[]
  encaminhamentos_tipo: { name: string; value: number }[]
  fila_por_estacao: { estacao: string; status: string; total: number }[]
  escolas_agendadas: { escola: string; data_atendimento: string; total_alunos: number }[]
  total_encaminhamentos: number
  encaminhamentos: { paciente_id: number; nome_completo: string; escola: string; diagnostico: string; conduta_inicial: string; conduta_final: string; observacoes: string; created_at: string }[]
}

const ESTACAO_LABELS: Record<string, string> = {
  acuidade: 'Acuidade',
  laudos: 'Laudos',
  oculos: 'Óculos',
}

const ESTACAO_COLORS: Record<string, string> = {
  acuidade: '#3182ce',
  laudos: '#38a169',
  oculos: '#d69e2e',
}

const CONDUTA_LABELS: Record<string, string> = {
  alta: 'Alta',
  onibus: 'Ônibus',
  encaminhamento: 'Encaminhamento',
}

const CONDUTA_COLORS: Record<string, string> = {
  alta: '#38a169',
  onibus: '#3182ce',
  encaminhamento: '#d69e2e',
}

export default function Dashboard() {
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [dataInicio, setDataInicio] = useState(hoje)
  const [dataFim, setDataFim] = useState(hoje)
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')

  const loadMetricas = useCallback(async (di: string, df: string, hi?: string, hf?: string) => {
    try {
      const params: Record<string, string> = { data_inicio: di, data_fim: df }
      if (hi) params.hora_inicio = hi
      if (hf) params.hora_fim = hf
      const { data } = await api.get('/dashboard/metricas', { params })
      setMetricas(data)
    } catch { /* interceptor */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadMetricas(dataInicio, dataFim, horaInicio, horaFim)
    const interval = setInterval(() => loadMetricas(dataInicio, dataFim, horaInicio, horaFim), 30000)
    return () => clearInterval(interval)
  }, [loadMetricas, dataInicio, dataFim, horaInicio, horaFim])

  const handleFilterApply = () => {
    setLoading(true)
    loadMetricas(dataInicio, dataFim, horaInicio, horaFim)
  }

  const handleFilterToday = () => {
    setDataInicio(hoje)
    setDataFim(hoje)
    setHoraInicio('')
    setHoraFim('')
    setLoading(true)
    loadMetricas(hoje, hoje)
  }

  // ── Layout customizado ─────────────────────────────────────
  const [customWidgets, setCustomWidgets] = useState<{i:string;x:number;y:number;w:number;h:number;type:string;config:Record<string,unknown>}[]>([])
  useEffect(() => {
    api.get('/dashboard-config').then(res => {
      setCustomWidgets(res.data?.layout?.widgets ?? [])
    }).catch(() => {})
  }, [])

  const widgetMetricas = useMemo(() => {
    if (!metricas) return null
    return {
      ...metricas,
      escolas_hoje: metricas.escolas_hoje.map(e => ({ escola: e.escola, hora: `${e.total} alunos` })),
      proximos_atendimentos: (metricas.escolas_agendadas ?? []).map(e => ({
        escola: e.escola,
        hora: new Date(e.data_atendimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      })),
      fila_por_estacao: (metricas.fila_por_estacao as {estacao:string;total:number}[]).reduce((acc, f) => {
        const ex = acc.find(a => a.estacao === f.estacao)
        if (ex) ex.quantidade += f.total
        else acc.push({ estacao: f.estacao, quantidade: f.total })
        return acc
      }, [] as {estacao:string;quantidade:number}[]),
      condutas_iniciais: metricas.condutas_iniciais ?? [],
      atendimentos_por_dia: metricas.atendimentos_por_dia ?? [],
      encaminhamentos_tipo: metricas.encaminhamentos_tipo ?? [],
      total_laudos: 0,
    }
  }, [metricas])

  function renderCustomWidget(widget: {i:string;type:string;config:Record<string,unknown>}) {
    if (!widgetMetricas) return null
    const cfg = widget.config
    const wm = widgetMetricas as Record<string, unknown>
    switch (widget.type) {
      case 'metric': {
        const val = wm[cfg.metric as string]
        return <MetricWidget title={cfg.title as string} value={typeof val === 'number' ? val : '--'} icon={cfg.icon as string} color={cfg.color as string} />
      }
      case 'schools-today':
        return <SchoolsWidget title={cfg.title as string} data={widgetMetricas.escolas_hoje} />
      case 'schools-scheduled':
        return <SchoolsWidget title={cfg.title as string} data={widgetMetricas.proximos_atendimentos} />
      case 'queue-stations':
        return <QueueWidget title={cfg.title as string} data={widgetMetricas.fila_por_estacao} />
      case 'chart-line':
      case 'chart-bar': {
        const data = (wm[cfg.dataKey as string] ?? []) as {name?:string;value?:number}[]
        return <ChartWidget title={cfg.title as string} data={data} type={widget.type === 'chart-line' ? 'line' : 'bar'} />
      }
      case 'chart-pie': {
        const data = (wm[cfg.dataKey as string] ?? []) as {name?:string;value?:number}[]
        return <ChartWidget title={cfg.title as string} data={data} type="pie" />
      }
      default: return null
    }
  }
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="dashboard">

      <div className="dashboard-filter-row">
        <div className="dashboard-filter-bar">
          <Filter size={16} />
          <span className="filter-label">De</span>
          <DatePicker value={dataInicio} onChange={setDataInicio} />
          <TimeWheelPicker value={horaInicio} onChange={setHoraInicio} placeholder="--:--" />
          <span className="filter-label">Até</span>
          <DatePicker value={dataFim} onChange={setDataFim} />
          <TimeWheelPicker value={horaFim} onChange={setHoraFim} placeholder="--:--" />
          <button className="btn-filter-apply" onClick={handleFilterApply}>Filtrar</button>
          {(dataInicio !== hoje || dataFim !== hoje || horaInicio || horaFim) && (
            <button className="btn-filter-today" onClick={handleFilterToday}>Hoje</button>
          )}
        </div>
        <Link to="/admin/dashboard-builder" className="dashboard-customize-btn">
          <Settings size={16} />
          <span>Personalizar</span>
        </Link>
      </div>

      {loading ? (
        <div className="loading">Carregando métricas...</div>
      ) : metricas && customWidgets.length > 0 ? (
        <div className="dashboard-custom-grid">
          {customWidgets.map(widget => (
            <div
              key={widget.i}
              style={{
                gridColumn: `${widget.x + 1} / span ${widget.w}`,
                gridRow: `${widget.y + 1} / span ${widget.h}`,
              }}
            >
              {renderCustomWidget(widget)}
            </div>
          ))}
        </div>
      ) : metricas ? (
        <>
          {/* === Cards principais === */}
          <div className="dashboard-cards">
            <Link to="/pacientes" className="dash-card dash-card-link">
              <div className="dash-card-icon" style={{ background: 'rgba(49,130,206,0.15)', color: '#63b3ed' }}><Users size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.total_matriculados}</span>
                <span className="dash-card-label">Total Matriculados</span>
              </div>
            </Link>

            <div className="dash-card dash-card-highlight">
              <div className="dash-card-icon" style={{ background: 'rgba(56,161,105,0.15)', color: '#48bb78' }}><School size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.pacientes_do_dia}</span>
                <span className="dash-card-label">Pacientes do Dia</span>
              </div>
            </div>

            <Link to="/fila" className="dash-card dash-card-link">
              <div className="dash-card-icon" style={{ background: 'rgba(214,158,46,0.15)', color: '#ecc94b' }}><ClipboardList size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.na_fila}</span>
                <span className="dash-card-label">Na Fila Agora</span>
              </div>
            </Link>

            <div className="dash-card">
              <div className="dash-card-icon" style={{ background: 'rgba(56,161,105,0.15)', color: '#68d391' }}><Stethoscope size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.atendimentos_hoje}</span>
                <span className="dash-card-label">Atendimentos</span>
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-card-icon" style={{ background: 'rgba(56,161,105,0.15)', color: '#38a169' }}><CheckCircle size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.total_altas}</span>
                <span className="dash-card-label">Altas</span>
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-card-icon" style={{ background: 'rgba(229,62,62,0.15)', color: '#fc8181' }}><Glasses size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.total_prescricoes}</span>
                <span className="dash-card-label">Óculos</span>
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-card-icon" style={{ background: 'rgba(214,158,46,0.15)', color: '#ecc94b' }}><ArrowRightLeft size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.total_encaminhamentos}</span>
                <span className="dash-card-label">Encaminhamentos</span>
              </div>
            </div>
          </div>

          {/* === Grid de detalhes === */}
          <div className="dashboard-grid">
            {/* Escolas de hoje */}
            <div className="dash-panel">
              <h3><School size={18} style={{verticalAlign:'middle',marginRight:6}} />Escolas do Dia</h3>
              {!metricas.escolas_hoje || metricas.escolas_hoje.length === 0 ? (
                <p className="dash-empty">Nenhuma escola agendada</p>
              ) : (
                <div className="escolas-hoje-list">
                  {metricas.escolas_hoje.map(e => (
                    <div key={e.escola} className="escola-hoje-item">
                      <School size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                      <span className="escola-hoje-nome">{e.escola}</span>
                      <span className="escola-hoje-count">{e.total} alunos</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Próximos Atendimentos */}
            <div className="dash-panel">
              <h3><CalendarDays size={18} style={{verticalAlign:'middle',marginRight:6}} />Próximos Atendimentos</h3>
              {!metricas.escolas_agendadas || metricas.escolas_agendadas.length === 0 ? (
                <p className="dash-empty">Nenhuma escola agendada</p>
              ) : (
                <div className="escolas-agendadas-list">
                  {metricas.escolas_agendadas.map((e, i) => {
                    const isHoje = e.data_atendimento === hoje
                    return (
                      <div key={i} className={`escola-agendada-item ${isHoje ? 'agendada-hoje' : ''}`}>
                        <span className="agendada-data">
                          {new Date(e.data_atendimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {isHoje && <span className="badge-hoje-sm">HOJE</span>}
                        </span>
                        <span className="agendada-escola">{e.escola}</span>
                        <span className="agendada-total">{e.total_alunos} alunos</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fila por estação */}
            <div className="dash-panel">
              <h3><ClipboardList size={18} style={{verticalAlign:'middle',marginRight:6}} />Fila por Estação</h3>
              {!Array.isArray(metricas.fila_por_estacao) || metricas.fila_por_estacao.length === 0 ? (
                <p className="dash-empty">Nenhum paciente na fila</p>
              ) : (
                <>
                  <div className="fila-estacao-grid">
                    {Object.keys(ESTACAO_LABELS).map(est => {
                      const items = metricas.fila_por_estacao.filter(f => f.estacao === est)
                      const total = items.reduce((s, i) => s + i.total, 0)
                      const color = ESTACAO_COLORS[est] ?? '#718096'
                      return (
                        <div key={est} className="fila-estacao-card" style={{ borderColor: color }}>
                          <div className="fila-estacao-total" style={{ color }}>{total}</div>
                          <div className="fila-estacao-nome">{ESTACAO_LABELS[est]}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Atendimentos últimos 7 dias */}
            <div className="dash-panel">
              <h3><TrendingUp size={18} style={{verticalAlign:'middle',marginRight:6}} />Últimos 7 Dias</h3>
              {!Array.isArray(metricas.atendimentos_por_dia) || metricas.atendimentos_por_dia.length === 0 ? (
                <p className="dash-empty">Sem atendimentos recentes</p>
              ) : (
                <div className="chart-container">
                  <div className="chart-grid-lines">
                    {[...Array(4)].map((_, i) => <div key={i} className="chart-grid-line" />)}
                  </div>
                  <div className="chart-bars">
                    {metricas.atendimentos_por_dia.map(d => {
                      const max = Math.max(...metricas.atendimentos_por_dia.map(x => x.value), 1)
                      const pct = (d.value / max) * 100
                      return (
                        <div key={d.name} className="chart-bar-col">
                          <span className="chart-bar-value">{d.value}</span>
                          <div className="chart-bar" style={{ height: `${pct}%` }} />
                          <span className="chart-bar-date">{d.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Condutas */}
            <div className="dash-panel">
              <h3><Tag size={18} style={{verticalAlign:'middle',marginRight:6}} />Condutas</h3>
              {(() => {
                const merged: Record<string, number> = {}
                for (const item of (metricas.condutas_iniciais ?? [])) {
                  const key = item.name === 'onibus_encaminhamento' ? 'encaminhamento' : item.name
                  merged[key] = (merged[key] ?? 0) + item.value
                }
                for (const item of (metricas.condutas_finais ?? [])) {
                  const key = item.name === 'onibus_encaminhamento' ? 'encaminhamento' : item.name
                  merged[key] = (merged[key] ?? 0) + item.value
                }
                const entries = Object.entries(merged)
                if (entries.length === 0) return <p className="dash-empty">Sem dados</p>
                return (
                  <div className="conduta-stats">
                    {entries.map(([key, val]) => (
                      <div key={key} className="conduta-stat-item">
                        <span className="conduta-dot" style={{ background: CONDUTA_COLORS[key] ?? '#718096' }} />
                        <span className="conduta-stat-label">{CONDUTA_LABELS[key] ?? key}</span>
                        <span className="conduta-stat-val">{val}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Resumo numérico */}
            <div className="dash-panel dash-panel-wide">
              <h3><Hash size={18} style={{verticalAlign:'middle',marginRight:6}} />Resumo do Dia</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-icon" style={{ background: 'rgba(49,130,206,0.12)', color: '#63b3ed' }}><Users size={20} /></div>
                  <span className="summary-num">{metricas.pacientes_do_dia}</span>
                  <span className="summary-label">Pacientes</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon" style={{ background: 'rgba(128,90,213,0.12)', color: '#b794f4' }}><Eye size={20} /></div>
                  <span className="summary-num">{metricas.total_exames}</span>
                  <span className="summary-label">Exames</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon" style={{ background: 'rgba(214,158,46,0.12)', color: '#ecc94b' }}><Glasses size={20} /></div>
                  <span className="summary-num">{metricas.total_prescricoes}</span>
                  <span className="summary-label">Prescrições</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon" style={{ background: 'rgba(56,161,105,0.12)', color: '#48bb78' }}><CheckCircle size={20} /></div>
                  <span className="summary-num">{metricas.total_altas}</span>
                  <span className="summary-label">Altas</span>
                </div>
                <div className="summary-item">
                  <div className="summary-icon" style={{ background: 'rgba(237,137,54,0.12)', color: '#ed8936' }}><ArrowRightLeft size={20} /></div>
                  <span className="summary-num">{metricas.total_encaminhamentos}</span>
                  <span className="summary-label">Encaminhamentos</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p>Erro ao carregar métricas.</p>
      )}
    </div>
  )
}

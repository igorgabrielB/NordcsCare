import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import api from '../../services/api.ts'
import { Users, ClipboardList, Stethoscope, BarChart3, TrendingUp, Tag, CheckCircle2, Hash } from 'lucide-react'
import './Dashboard.css'

interface Metricas {
  total_pacientes: number
  atendimentos_hoje: number
  na_fila: number
  total_exames: number
  total_prescricoes: number
  total_laudos: number
  condutas_iniciais: Record<string, number>
  condutas_finais: Record<string, number>
  atendimentos_por_dia: { dia: string; total: number }[]
  fila_por_estacao: { estacao: string; status: string; total: number }[]
}

const ESTACAO_LABELS: Record<string, string> = {
  acuidade: 'Acuidade',
  exames: 'Exames',
  laudos: 'Laudos',
  oculos: 'Óculos',
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
  const { user } = useAuth()
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetricas()
    const interval = setInterval(loadMetricas, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadMetricas() {
    try {
      const { data } = await api.get('/dashboard/metricas')
      setMetricas(data)
    } catch { /* interceptor */ } finally { setLoading(false) }
  }

  function diaSemana(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  }

  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <h1>Bem-vindo, {user?.nome}!</h1>
        <p>Sistema de Prontuário Oftalmológico — NordcsCare</p>
      </div>

      {loading ? (
        <div className="loading">Carregando métricas...</div>
      ) : metricas ? (
        <>
          {/* === Cards principais === */}
          <div className="dashboard-cards">
            <Link to="/pacientes" className="dash-card dash-card-link">
              <div className="dash-card-icon" style={{ background: 'rgba(49,130,206,0.15)', color: '#63b3ed' }}><Users size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.total_pacientes}</span>
                <span className="dash-card-label">Pacientes</span>
              </div>
            </Link>

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
                <span className="dash-card-label">Atendimentos Hoje</span>
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-card-icon" style={{ background: 'rgba(115,69,214,0.15)', color: '#b794f4' }}><BarChart3 size={24} /></div>
              <div className="dash-card-info">
                <span className="dash-card-number">{metricas.total_laudos}</span>
                <span className="dash-card-label">Total de Laudos</span>
              </div>
            </div>
          </div>

          {/* === Grid de detalhes === */}
          <div className="dashboard-grid">
            {/* Fila por estação */}
            <div className="dash-panel">
              <h3><ClipboardList size={18} style={{verticalAlign:'middle',marginRight:6}} />Fila por Estação</h3>
              {!Array.isArray(metricas.fila_por_estacao) || metricas.fila_por_estacao.length === 0 ? (
                <p className="dash-empty">Nenhum paciente na fila</p>
              ) : (
                <div className="fila-bars">
                  {Object.keys(ESTACAO_LABELS).map(est => {
                    const items = metricas.fila_por_estacao.filter(f => f.estacao === est)
                    const total = items.reduce((s, i) => s + i.total, 0)
                    if (total === 0) return null
                    const aguardando = items.find(i => i.status === 'aguardando')?.total ?? 0
                    const atendendo = items.find(i => i.status === 'em_atendimento')?.total ?? 0
                    return (
                      <div key={est} className="fila-bar-row">
                        <span className="fila-bar-label">{ESTACAO_LABELS[est]}</span>
                        <div className="fila-bar-track">
                          {atendendo > 0 && <div className="fila-bar fila-bar-atendendo" style={{ flex: atendendo }}>{atendendo}</div>}
                          {aguardando > 0 && <div className="fila-bar fila-bar-aguardando" style={{ flex: aguardando }}>{aguardando}</div>}
                        </div>
                        <span className="fila-bar-total">{total}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Atendimentos últimos 7 dias */}
            <div className="dash-panel">
              <h3><TrendingUp size={18} style={{verticalAlign:'middle',marginRight:6}} />Últimos 7 Dias</h3>
              {!Array.isArray(metricas.atendimentos_por_dia) || metricas.atendimentos_por_dia.length === 0 ? (
                <p className="dash-empty">Sem atendimentos recentes</p>
              ) : (
                <div className="chart-bars">
                  {metricas.atendimentos_por_dia.map(d => {
                    const max = Math.max(...metricas.atendimentos_por_dia.map(x => x.total), 1)
                    return (
                      <div key={d.dia} className="chart-bar-col">
                        <span className="chart-bar-value">{d.total}</span>
                        <div className="chart-bar" style={{ height: `${(d.total / max) * 100}%` }} />
                        <span className="chart-bar-label">{diaSemana(d.dia)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Condutas iniciais */}
            <div className="dash-panel">
              <h3><Tag size={18} style={{verticalAlign:'middle',marginRight:6}} />Condutas Iniciais</h3>
              {!metricas.condutas_iniciais || Object.keys(metricas.condutas_iniciais).length === 0 ? (
                <p className="dash-empty">Sem dados</p>
              ) : (
                <div className="conduta-stats">
                  {Object.entries(metricas.condutas_iniciais).map(([key, val]) => (
                    <div key={key} className="conduta-stat-item">
                      <span className="conduta-dot" style={{ background: CONDUTA_COLORS[key] ?? '#718096' }} />
                      <span className="conduta-stat-label">{CONDUTA_LABELS[key] ?? key}</span>
                      <span className="conduta-stat-val">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Condutas finais */}
            <div className="dash-panel">
              <h3><CheckCircle2 size={18} style={{verticalAlign:'middle',marginRight:6}} />Condutas Finais</h3>
              {!metricas.condutas_finais || Object.keys(metricas.condutas_finais).length === 0 ? (
                <p className="dash-empty">Sem dados</p>
              ) : (
                <div className="conduta-stats">
                  {Object.entries(metricas.condutas_finais).map(([key, val]) => (
                    <div key={key} className="conduta-stat-item">
                      <span className="conduta-dot" style={{ background: CONDUTA_COLORS[key] ?? '#718096' }} />
                      <span className="conduta-stat-label">{CONDUTA_LABELS[key] ?? key}</span>
                      <span className="conduta-stat-val">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo numérico */}
            <div className="dash-panel dash-panel-wide">
              <h3><Hash size={18} style={{verticalAlign:'middle',marginRight:6}} />Resumo Geral</h3>
              <div className="summary-grid">
                <div className="summary-item"><span className="summary-num">{metricas.total_exames}</span><span>Exames realizados</span></div>
                <div className="summary-item"><span className="summary-num">{metricas.total_prescricoes}</span><span>Prescrições emitidas</span></div>
                <div className="summary-item"><span className="summary-num">{metricas.total_laudos}</span><span>Laudos emitidos</span></div>
                <div className="summary-item"><span className="summary-num">{metricas.total_pacientes}</span><span>Pacientes cadastrados</span></div>
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

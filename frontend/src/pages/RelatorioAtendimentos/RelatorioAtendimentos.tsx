import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { BarChart3, Download, FileSpreadsheet, Search, Filter, Calendar, Building2, Activity, Users, Clock, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import './RelatorioAtendimentos.css'

interface Resumo {
  total_atendimentos: number
  por_resultado: { resultado: string; total: number }[]
  por_escola: { escola: string; total: number }[]
  por_dia: { data_atendimento: string; total: number }[]
  media_minutos: number | null
  por_medico: { medico_nome: string; total: number }[]
}

interface HistoricoItem {
  id: number
  paciente_id: number
  nome_completo: string
  cpf: string
  codigo: string | null
  escola: string | null
  data_atendimento: string
  hora_entrada: string
  hora_saida: string | null
  resultado: string
  diagnostico: string | null
  conduta_inicial: string | null
  conduta_final: string | null
  medico_nome: string | null
}

interface HistoricoResponse {
  data: HistoricoItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const RESULTADO_LABELS: Record<string, string> = {
  alta: 'Alta',
  encaminhamento: 'Encaminhamento',
  oculos: 'Óculos (Alta)',
  oculos_encaminhamento: 'Óculos (Encaminhamento)',
}

const RESULTADO_COLORS: Record<string, string> = {
  alta: '#48bb78',
  encaminhamento: '#ed8936',
  oculos: '#4299e1',
  oculos_encaminhamento: '#ed64a6',
}

export default function RelatorioAtendimentos() {
  const [tab, setTab] = useState<'resumo' | 'lista'>('resumo')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [escola, setEscola] = useState('')
  const [resultado, setResultado] = useState('')
  const [escolas, setEscolas] = useState<string[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [historico, setHistorico] = useState<HistoricoResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchPaciente, setSearchPaciente] = useState('')

  useEffect(() => {
    api.get('/historico/escolas').then(r => setEscolas(r.data)).catch(() => {})
    const hoje = new Date()
    const inicio = new Date(hoje)
    inicio.setDate(inicio.getDate() - 30)
    setDataInicio(inicio.toISOString().split('T')[0])
    setDataFim(hoje.toISOString().split('T')[0])
  }, [])

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {}
    if (dataInicio) params.data_inicio = dataInicio
    if (dataFim) params.data_fim = dataFim
    if (escola) params.escola = escola
    if (resultado) params.resultado = resultado
    return params
  }, [dataInicio, dataFim, escola, resultado])

  const fetchResumo = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/historico/resumo', { params: buildParams() })
      setResumo(res.data)
    } catch {
      console.error('Erro ao carregar resumo')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const fetchHistorico = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await api.get('/historico', { params: { ...buildParams(), page: p, limit: 25 } })
      setHistorico(res.data)
      setPage(p)
    } catch {
      console.error('Erro ao carregar histórico')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    if (!dataInicio || !dataFim) return
    if (tab === 'resumo') fetchResumo()
    else fetchHistorico(1)
  }, [tab, dataInicio, dataFim, escola, resultado, fetchResumo, fetchHistorico])

  const exportarCSV = () => {
    const params = new URLSearchParams(buildParams())
    const baseUrl = api.defaults.baseURL || ''
    const token = localStorage.getItem('token')
    window.open(`${baseUrl}/historico/exportar?${params.toString()}&token=${token}`, '_blank')
  }

  const maxBar = resumo?.por_escola?.length
    ? Math.max(...resumo.por_escola.map(e => e.total))
    : 0

  const maxDiaBar = resumo?.por_dia?.length
    ? Math.max(...resumo.por_dia.map(d => d.total))
    : 0

  const filteredHistorico = historico?.data?.filter(item =>
    !searchPaciente || item.nome_completo.toLowerCase().includes(searchPaciente.toLowerCase())
  ) || []

  return (
    <div className="rela-page">
      {/* Hero */}
      <div className="rela-hero">
        <div className="rela-hero-bg-deco" />
        <div className="rela-hero-top">
          <Link to="/relatorios" className="rela-btn-back">
            <ArrowLeft size={16} /> Relatórios
          </Link>
        </div>
        <div className="rela-hero-content">
          <div className="rela-hero-icon">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1>Relatório de Atendimentos</h1>
            <p className="rela-hero-subtitle">Histórico completo de atendimentos finalizados</p>
          </div>
        </div>
        <div className="rela-hero-stats">
          <div className="rela-hero-stat">
            <div className="rela-hero-stat-icon rela-hsi-total">
              <Activity size={16} />
            </div>
            <div className="rela-hero-stat-info">
              <span className="rela-hero-stat-value">{resumo?.total_atendimentos ?? '—'}</span>
              <span className="rela-hero-stat-label">Atendimentos</span>
            </div>
          </div>
          <div className="rela-hero-stat">
            <div className="rela-hero-stat-icon rela-hsi-tempo">
              <Clock size={16} />
            </div>
            <div className="rela-hero-stat-info">
              <span className="rela-hero-stat-value">{resumo?.media_minutos ? `${resumo.media_minutos}min` : '—'}</span>
              <span className="rela-hero-stat-label">Tempo Médio</span>
            </div>
          </div>
          <div className="rela-hero-stat">
            <div className="rela-hero-stat-icon rela-hsi-medicos">
              <Users size={16} />
            </div>
            <div className="rela-hero-stat-info">
              <span className="rela-hero-stat-value">{resumo?.por_medico?.length ?? '—'}</span>
              <span className="rela-hero-stat-label">Médicos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rela-filters">
        <div className="rela-filters-row">
          <div className="rela-filter-group">
            <Calendar size={14} />
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            <span className="rela-filter-sep">até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className="rela-filter-group">
            <Building2 size={14} />
            <select value={escola} onChange={e => setEscola(e.target.value)}>
              <option value="">Todas as escolas</option>
              {escolas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="rela-filter-group">
            <Filter size={14} />
            <select value={resultado} onChange={e => setResultado(e.target.value)}>
              <option value="">Todos os resultados</option>
              <option value="alta">Alta</option>
              <option value="encaminhamento">Encaminhamento</option>
              <option value="oculos">Óculos (Alta)</option>
              <option value="oculos_encaminhamento">Óculos (Encaminhamento)</option>
            </select>
          </div>
          <button className="rela-btn-export" onClick={exportarCSV}>
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rela-tabs">
        <button className={`rela-tab ${tab === 'resumo' ? 'active' : ''}`} onClick={() => setTab('resumo')}>
          <BarChart3 size={15} /> Resumo
        </button>
        <button className={`rela-tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>
          <FileSpreadsheet size={15} /> Lista de Atendimentos
        </button>
      </div>

      {loading && <div className="rela-loading">Carregando...</div>}

      {/* Resumo Tab */}
      {tab === 'resumo' && resumo && !loading && (
        <div className="rela-resumo">
          {/* Resultado Distribution */}
          <div className="rela-card">
            <h3>Distribuição por Resultado</h3>
            {resumo.por_resultado.length === 0 ? (
              <p className="rela-empty">Nenhum dado no período</p>
            ) : (
              <div className="rela-resultado-grid">
                {resumo.por_resultado.map(r => {
                  const pct = resumo.total_atendimentos > 0 ? ((r.total / resumo.total_atendimentos) * 100).toFixed(1) : '0'
                  return (
                    <div key={r.resultado} className="rela-resultado-item">
                      <div className="rela-resultado-header">
                        <span className="rela-resultado-dot" style={{ background: RESULTADO_COLORS[r.resultado] || '#a0aec0' }} />
                        <span className="rela-resultado-label">{RESULTADO_LABELS[r.resultado] || r.resultado}</span>
                        <span className="rela-resultado-count">{r.total}</span>
                      </div>
                      <div className="rela-resultado-bar-bg">
                        <div className="rela-resultado-bar" style={{ width: `${pct}%`, background: RESULTADO_COLORS[r.resultado] || '#a0aec0' }} />
                      </div>
                      <span className="rela-resultado-pct">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Por Escola */}
          <div className="rela-card">
            <h3>Atendimentos por Escola</h3>
            {resumo.por_escola.length === 0 ? (
              <p className="rela-empty">Nenhum dado no período</p>
            ) : (
              <div className="rela-escola-list">
                {resumo.por_escola.slice(0, 10).map(e => (
                  <div key={e.escola} className="rela-escola-item">
                    <span className="rela-escola-nome">{e.escola}</span>
                    <div className="rela-escola-bar-bg">
                      <div className="rela-escola-bar" style={{ width: `${maxBar > 0 ? (e.total / maxBar) * 100 : 0}%` }} />
                    </div>
                    <span className="rela-escola-count">{e.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evolução por Dia */}
          {resumo.por_dia.length > 0 && (
            <div className="rela-card rela-card-full">
              <h3>Evolução Diária</h3>
              <div className="rela-chart-bars">
                {resumo.por_dia.map(d => (
                  <div key={d.data_atendimento} className="rela-chart-col">
                    <span className="rela-chart-val">{d.total}</span>
                    <div className="rela-chart-bar" style={{ height: `${maxDiaBar > 0 ? (d.total / maxDiaBar) * 100 : 0}%` }} />
                    <span className="rela-chart-label">{new Date(d.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por Médico */}
          {resumo.por_medico.length > 0 && (
            <div className="rela-card">
              <h3>Atendimentos por Médico</h3>
              <div className="rela-escola-list">
                {resumo.por_medico.map(m => {
                  const maxMedico = Math.max(...resumo.por_medico.map(x => x.total))
                  return (
                    <div key={m.medico_nome} className="rela-escola-item">
                      <span className="rela-escola-nome">{m.medico_nome}</span>
                      <div className="rela-escola-bar-bg">
                        <div className="rela-escola-bar" style={{ width: `${maxMedico > 0 ? (m.total / maxMedico) * 100 : 0}%`, background: '#805ad5' }} />
                      </div>
                      <span className="rela-escola-count">{m.total}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Tab */}
      {tab === 'lista' && !loading && historico && (
        <div className="rela-lista">
          <div className="rela-lista-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Filtrar por nome do paciente..."
              value={searchPaciente}
              onChange={e => setSearchPaciente(e.target.value)}
            />
          </div>

          <div className="rela-table-wrap">
            <table className="rela-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Escola</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Resultado</th>
                  <th>Diagnóstico</th>
                  <th>Médico</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistorico.length === 0 ? (
                  <tr><td colSpan={8} className="rela-empty">Nenhum atendimento encontrado</td></tr>
                ) : (
                  filteredHistorico.map(item => (
                    <tr key={item.id}>
                      <td>{new Date(item.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td><strong>{item.nome_completo}</strong></td>
                      <td>{item.escola || '—'}</td>
                      <td>{item.hora_entrada?.substring(0, 5)}</td>
                      <td>{item.hora_saida?.substring(0, 5) || '—'}</td>
                      <td>
                        <span className="rela-resultado-badge" style={{ background: (RESULTADO_COLORS[item.resultado] || '#a0aec0') + '22', color: RESULTADO_COLORS[item.resultado] || '#a0aec0' }}>
                          {RESULTADO_LABELS[item.resultado] || item.resultado}
                        </span>
                      </td>
                      <td className="rela-td-diag">{item.diagnostico || '—'}</td>
                      <td>{item.medico_nome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {historico.pages > 1 && (
            <div className="rela-pagination">
              <button disabled={page <= 1} onClick={() => fetchHistorico(page - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span>Página {page} de {historico.pages} ({historico.total} registros)</span>
              <button disabled={page >= historico.pages} onClick={() => fetchHistorico(page + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api.ts'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { Eye, FileText, Glasses, Zap, Timer, Building2, User, ClipboardList, X, ArrowRight, CheckCircle2, Send, Lock, Search, School, Bell, ArrowLeft } from 'lucide-react'
import './Fila.css'

interface FilaItem {
  id: number
  paciente_id: number
  estacao: string
  status: string
  prioridade: number
  observacoes: string | null
  atendente_id: number | null
  atendente_nome: string | null
  created_at: string
  updated_at: string
  nome_completo: string
  codigo: string | null
  convenio: string | null
  escola: string | null
  senha: string | null
}

interface Especialidade {
  id: number
  nome: string
  cor: string
}

interface EstacaoDef {
  id: number
  nome: string
  label: string
  cor: string
  icone: string
  tipo: string
  ordem: number
}

type FilaAgrupada = Record<string, FilaItem[]>

// Fallback para quando não há especialidades no banco ainda
const ESTACOES_FALLBACK: EstacaoDef[] = [
  { id: 0, nome: 'acuidade',        label: 'Acuidade',         cor: '#38a169', icone: 'eye',          tipo: 'atendimento', ordem: 1 },
  { id: 0, nome: 'laudos',          label: 'Laudos',           cor: '#805ad5', icone: 'file-text',    tipo: 'atendimento', ordem: 2 },
  { id: 0, nome: 'oculos',          label: 'Óculos',           cor: '#e53e3e', icone: 'glasses',      tipo: 'atendimento', ordem: 3 },
  { id: 0, nome: 'altas',           label: 'Altas',            cor: '#22863a', icone: 'check-circle', tipo: 'saida',       ordem: 4 },
  { id: 0, nome: 'encaminhamentos', label: 'Encaminhamentos',  cor: '#6f42c1', icone: 'send',         tipo: 'saida',       ordem: 5 },
]

export default function Fila() {
  const { user, isAdmin, hasTela } = useAuth()
  const navigate = useNavigate()
  const [fila, setFila] = useState<FilaAgrupada>({})
  const [loading, setLoading] = useState(true)

  // Especialidades
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [selectedEspId, setSelectedEspId] = useState<number | null>(null)
  const [estacoes, setEstacoes] = useState<EstacaoDef[]>(ESTACOES_FALLBACK)

  // Carregar especialidades ao montar
  useEffect(() => {
    api.get('/especialidades').then(({ data }) => {
      const ativas = (data as Especialidade[]).filter((e: any) => e.ativo)
      setEspecialidades(ativas)
      if (ativas.length > 0) setSelectedEspId(ativas[0].id)
    }).catch(() => {})
  }, [])

  // Carregar estações quando especialidade muda
  useEffect(() => {
    if (!selectedEspId) { setEstacoes(ESTACOES_FALLBACK); return }
    api.get(`/especialidades/${selectedEspId}/estacoes`).then(({ data }) => {
      setEstacoes(data.length > 0 ? data : ESTACOES_FALLBACK)
    }).catch(() => setEstacoes(ESTACOES_FALLBACK))
  }, [selectedEspId])

  const fetchFila = useCallback(async () => {
    try {
      const params = selectedEspId ? { especialidade_id: selectedEspId } : {}
      const res = await api.get('/fila', { params })
      setFila(res.data)
    } catch {
      console.error('Erro ao carregar fila')
    } finally {
      setLoading(false)
    }
  }, [selectedEspId])

  useEffect(() => {
    fetchFila()
    const interval = setInterval(fetchFila, 8000) // Polling 8s
    return () => clearInterval(interval)
  }, [fetchFila])

  const avancarEstacao = async (filaId: number) => {
    try {
      await api.put(`/fila/${filaId}/avancar`)
      fetchFila()
    } catch {
      alert('Erro ao mover paciente')
    }
  }

  const removerDaFila = async (filaId: number, nome: string) => {
    if (!window.confirm(`Remover "${nome}" da fila?`)) return
    try {
      await api.delete(`/fila/${filaId}`)
      fetchFila()
    } catch {
      alert('Erro ao remover da fila')
    }
  }

  const togglePrioridade = async (filaId: number) => {
    try {
      await api.put(`/fila/${filaId}/prioridade`)
      fetchFila()
    } catch {
      alert('Erro ao alterar prioridade')
    }
  }

  const chamarPainel = async (filaId: number) => {
    try {
      await api.post(`/fila/${filaId}/chamar`)
    } catch {
      alert('Erro ao chamar paciente no painel')
    }
  }

  const formatTempo = (diffMs: number): string => {
    const mins = Math.floor(diffMs / 60000)
    if (mins < 60) return `${mins}min`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h${mins % 60}min`
  }

  // Tempo na estação atual (live, conta a partir do updated_at — reinicia à meia-noite)
  const getTempoEstacao = (updatedAt: string): string => {
    const inicio = new Date(updatedAt).getTime()
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const base = Math.max(inicio, hoje.getTime())
    return formatTempo(Date.now() - base)
  }

  // Tempo total de atendimento (created_at → updated_at, congelado)
  const getTempoTotal = (createdAt: string, updatedAt: string): string => {
    return formatTempo(new Date(updatedAt).getTime() - new Date(createdAt).getTime())
  }

  // Média de atendimento dos pacientes finalizados (altas + encaminhamentos) — só do dia atual
  const getMediaAtendimento = (): string | null => {
    const hoje = new Date().toISOString().slice(0, 10)
    const finalizados = [...(fila['altas'] || []), ...(fila['encaminhamentos'] || [])]
      .filter(item => item.created_at.slice(0, 10) === hoje)
    if (finalizados.length === 0) return null
    const totalMs = finalizados.reduce((acc, item) => {
      return acc + (new Date(item.updated_at).getTime() - new Date(item.created_at).getTime())
    }, 0)
    return formatTempo(totalMs / finalizados.length)
  }

  const canManage = isAdmin || user?.role === 'administrativo'
  const canChamar = hasTela('chamar_paciente')
  const [collapsedStations, setCollapsedStations] = useState<Record<string, boolean>>({})
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({})
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({})

  const toggleStation = (key: string) => {
    setCollapsedStations(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleCard = (id: number) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) return <div className="loading">Carregando fila...</div>

  const ultimaEstacao = estacoes.length > 0 ? estacoes[estacoes.length - 1].nome : ''

  return (
    <div className="fila-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn-voltar" onClick={() => navigate('/menu')}>
            <ArrowLeft size={16} />Voltar
          </button>
          <h1>Fila de Atendimento</h1>
        </div>
        <div className="page-header-right">
          {getMediaAtendimento() && (
            <span className="media-atendimento">
              <Timer size={16} style={{verticalAlign:'middle',marginRight:4}} />
              Média: {getMediaAtendimento()}
            </span>
          )}
        </div>
      </div>

      {/* Abas de especialidade */}
      {especialidades.length > 1 && (
        <div className="fila-esp-tabs">
          {especialidades.map((esp) => (
            <button
              key={esp.id}
              className={`fila-esp-tab${selectedEspId === esp.id ? ' fila-esp-tab--active' : ''}`}
              style={selectedEspId === esp.id ? { background: esp.cor } : {}}
              onClick={() => { setSelectedEspId(esp.id); setLoading(true) }}
            >
              {esp.nome}
            </button>
          ))}
        </div>
      )}

      <div className="kanban-board">
        {estacoes.map((estacao) => {
          const isAtendimento = estacao.tipo === 'atendimento'
          const isLastStation = estacao.nome === ultimaEstacao
          const allItems = fila[estacao.nome] || []
          const isCollapsed = !!collapsedStations[estacao.nome]
          const searchTerm = (stationSearch[estacao.nome] || '').toLowerCase()
          const items = searchTerm
            ? allItems.filter(i => i.nome_completo.toLowerCase().includes(searchTerm) || (i.codigo && i.codigo.toLowerCase().includes(searchTerm)))
            : allItems
          return (
            <div className={`kanban-column ${isCollapsed ? 'collapsed' : ''} ${!isAtendimento ? 'saida' : ''}`} key={estacao.nome}>
              <div
                className="kanban-header"
                style={{ borderTopColor: estacao.cor }}
                onClick={() => toggleStation(estacao.nome)}
              >
                <span className="kanban-icon"><FileText size={18} /></span>
                <span className="kanban-title">{estacao.label}</span>
                <span className="kanban-count">{allItems.length}</span>
                <span className={`kanban-chevron ${isCollapsed ? 'chevron-collapsed' : ''}`}>▼</span>
              </div>

              {!isCollapsed && (
                <>
                {allItems.length > 0 && (
                  <div className="kanban-search">
                    <Search size={14} className="kanban-search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar paciente..."
                      value={stationSearch[estacao.nome] || ''}
                      onChange={(e) => setStationSearch(prev => ({ ...prev, [estacao.nome]: e.target.value }))}
                      className="kanban-search-input"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchTerm && (
                      <button className="kanban-search-clear" onClick={() => setStationSearch(prev => ({ ...prev, [estacao.nome]: '' }))}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div className="kanban-cards">
                  {items.length === 0 ? (
                    <div className="kanban-empty">{searchTerm ? 'Nenhum resultado' : 'Nenhum paciente'}</div>
                  ) : (
                    items.map((item) => {
                      const isExpanded = !!expandedCards[item.id]
                      return (
                        <div
                          className={`kanban-card em-atendimento ${!isAtendimento ? 'concluded' : ''} ${item.prioridade > 0 ? 'prioritario' : ''}`}
                          key={item.id}
                          style={{ '--card-accent': estacao.cor } as React.CSSProperties}
                        >
                          <div className="card-top" onClick={() => toggleCard(item.id)}>
                            <div className="card-top-left">
                              <span className={`card-chevron ${isExpanded ? '' : 'chevron-collapsed'}`}>▼</span>
                              <strong className="card-nome">{item.nome_completo}</strong>
                              {isLastStation && <span title="Última estação — somente admin pode alterar"><Lock size={14} className="card-lock" /></span>}
                            </div>
                            <div className="card-top-right">
                              {item.senha && <span className="card-senha">{item.senha}</span>}
                              {item.prioridade > 0 && <span className="card-prioridade"><Zap size={14} /></span>}
                              <span className="card-tempo" title={!isAtendimento ? 'Tempo total de atendimento' : 'Tempo na estação'}>
                                <Timer size={13} />
                                {!isAtendimento ? getTempoTotal(item.created_at, item.updated_at) : getTempoEstacao(item.updated_at)}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="card-drawer">
                              {item.escola && <div className="card-info"><School size={14} style={{verticalAlign:'middle',marginRight:4}} />{item.escola}</div>}
                              {item.codigo && <div className="card-info">Código: #{item.codigo}</div>}
                              {item.convenio && <div className="card-info"><Building2 size={14} style={{verticalAlign:'middle',marginRight:4}} />{item.convenio}</div>}

                              {item.atendente_nome && (
                                <div className="card-info"><User size={14} style={{verticalAlign:'middle',marginRight:4}} />{item.atendente_nome}</div>
                              )}

                              <div className="card-actions">
                                {isAtendimento && (
                                  <>
                                    <Link
                                      to={`/prontuario/${item.paciente_id}`}
                                      className="btn-card btn-prontuario"
                                      title="Abrir prontuário"
                                    >
                                      <ClipboardList size={14} style={{verticalAlign:'middle',marginRight:3}} />Prontuário
                                    </Link>
                                    {canManage && (
                                      <button
                                        className={`btn-card btn-prioridade ${item.prioridade > 0 ? 'active' : ''}`}
                                        onClick={() => togglePrioridade(item.id)}
                                        title={item.prioridade > 0 ? 'Remover prioridade' : 'Marcar como prioridade'}
                                      >
                                        <Zap size={14} />{item.prioridade > 0 ? 'Prioridade' : 'Priorizar'}
                                      </button>
                                    )}
                                    {canChamar && (
                                      <button
                                        className="btn-card btn-chamar"
                                        onClick={() => chamarPainel(item.id)}
                                        title="Chamar no painel de senha"
                                      >
                                        <Bell size={14} />Chamar
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        className="btn-card btn-avancar"
                                        onClick={() => avancarEstacao(item.id)}
                                        title="Avançar para próxima estação"
                                      >
                                        <ArrowRight size={14} style={{verticalAlign:'middle',marginRight:3}} />Avançar
                                      </button>
                                    )}
                                  </>
                                )}

                                {!isAtendimento && (
                                  <Link
                                    to={`/prontuario/${item.paciente_id}`}
                                    className="btn-card btn-prontuario"
                                    title="Abrir prontuário"
                                  >
                                    <ClipboardList size={14} style={{verticalAlign:'middle',marginRight:3}} />Prontuário
                                  </Link>
                                )}

                                {(isLastStation ? isAdmin : canManage) && (
                                  <button
                                    className="btn-card btn-remover"
                                    onClick={() => removerDaFila(item.id, item.nome_completo)}
                                    title="Remover da fila"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                </>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}

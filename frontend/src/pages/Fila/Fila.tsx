import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { Eye, Microscope, FileText, Glasses, Zap, Timer, Building2, User, ClipboardList, X, ArrowRight, CheckCircle2, Send } from 'lucide-react'
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
  cpf: string | null
  convenio: string | null
}

interface PacienteDisponivel {
  id: number
  nome_completo: string
  cpf: string | null
  convenio: string | null
}

type FilaAgrupada = Record<string, FilaItem[]>

const ESTACOES = [
  { key: 'acuidade', label: 'Acuidade', icon: <Eye size={18} />, color: '#38a169', isAtendimento: true },
  { key: 'exames', label: 'Exames', icon: <Microscope size={18} />, color: '#d69e2e', isAtendimento: true },
  { key: 'laudos', label: 'Laudos', icon: <FileText size={18} />, color: '#805ad5', isAtendimento: true },
  { key: 'oculos', label: 'Óculos', icon: <Glasses size={18} />, color: '#e53e3e', isAtendimento: true },
  { key: 'altas', label: 'Altas', icon: <CheckCircle2 size={18} />, color: '#22863a', isAtendimento: false },
  { key: 'encaminhamentos', label: 'Encaminhamentos', icon: <Send size={18} />, color: '#6f42c1', isAtendimento: false },
]

export default function Fila() {
  const { user } = useAuth()
  const [fila, setFila] = useState<FilaAgrupada>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchPaciente, setSearchPaciente] = useState('')
  const [pacientesDisponiveis, setPacientesDisponiveis] = useState<PacienteDisponivel[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const fetchFila = useCallback(async () => {
    try {
      const res = await api.get('/fila')
      setFila(res.data)
    } catch {
      console.error('Erro ao carregar fila')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFila()
    const interval = setInterval(fetchFila, 8000) // Polling 8s
    return () => clearInterval(interval)
  }, [fetchFila])

  const buscarPacientes = async (term: string) => {
    setSearchPaciente(term)
    if (term.length < 2) {
      setPacientesDisponiveis([])
      return
    }
    setSearchLoading(true)
    try {
      const res = await api.get('/fila/pacientes-disponiveis', { params: { search: term } })
      setPacientesDisponiveis(res.data)
    } catch {
      console.error('Erro ao buscar pacientes')
    } finally {
      setSearchLoading(false)
    }
  }

  const adicionarNaFila = async (pacienteId: number) => {
    try {
      await api.post('/fila', { paciente_id: pacienteId })
      setShowModal(false)
      setSearchPaciente('')
      setPacientesDisponiveis([])
      fetchFila()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      alert(axiosErr.response?.data?.error || 'Erro ao adicionar paciente')
    }
  }

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

  const getTempoEstacao = (updatedAt: string): string => {
    const diff = Date.now() - new Date(updatedAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h${mins % 60}min`
  }

  const canManage = user?.role === 'admin' || user?.role === 'recepcionista'
  const [collapsedStations, setCollapsedStations] = useState<Record<string, boolean>>({})
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({})

  const toggleStation = (key: string) => {
    setCollapsedStations(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleCard = (id: number) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) return <div className="loading">Carregando fila...</div>

  return (
    <div className="fila-page">
      <div className="page-header">
        <h1>Fila de Atendimento</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Adicionar Paciente
          </button>
        )}
      </div>

      <div className="kanban-board">
        {ESTACOES.map((estacao) => {
          const items = fila[estacao.key] || []
          const isCollapsed = !!collapsedStations[estacao.key]
          return (
            <div className={`kanban-column ${isCollapsed ? 'collapsed' : ''} ${!estacao.isAtendimento ? 'saida' : ''}`} key={estacao.key}>
              <div
                className="kanban-header"
                style={{ borderTopColor: estacao.color }}
                onClick={() => toggleStation(estacao.key)}
              >
                <span className="kanban-icon">{estacao.icon}</span>
                <span className="kanban-title">{estacao.label}</span>
                <span className="kanban-count">{items.length}</span>
                <span className={`kanban-chevron ${isCollapsed ? 'chevron-collapsed' : ''}`}>▼</span>
              </div>

              {!isCollapsed && (
                <div className="kanban-cards">
                  {items.length === 0 ? (
                    <div className="kanban-empty">Nenhum paciente</div>
                  ) : (
                    items.map((item) => {
                      const isExpanded = !!expandedCards[item.id]
                      return (
                        <div
                          className={`kanban-card em-atendimento ${!estacao.isAtendimento ? 'concluded' : ''}`}
                          key={item.id}
                        >
                          <div className="card-top" onClick={() => toggleCard(item.id)}>
                            <div className="card-top-left">
                              <span className={`card-chevron ${isExpanded ? '' : 'chevron-collapsed'}`}>▼</span>
                              <strong className="card-nome">{item.nome_completo}</strong>
                            </div>
                            <div className="card-top-right">
                              {item.prioridade > 0 && <span className="card-prioridade"><Zap size={14} /></span>}
                              <span className="card-tempo"><Timer size={14} style={{verticalAlign:'middle',marginRight:3}} />{getTempoEstacao(item.updated_at)}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="card-drawer">
                              {item.cpf && <div className="card-info">CPF: {item.cpf}</div>}
                              {item.convenio && <div className="card-info"><Building2 size={14} style={{verticalAlign:'middle',marginRight:4}} />{item.convenio}</div>}

                              {item.atendente_nome && (
                                <div className="card-info"><User size={14} style={{verticalAlign:'middle',marginRight:4}} />{item.atendente_nome}</div>
                              )}

                              <div className="card-actions">
                                {estacao.isAtendimento && (
                                  <>
                                    <Link
                                      to={`/prontuario/${item.paciente_id}`}
                                      className="btn-card btn-prontuario"
                                      title="Abrir prontuário"
                                    >
                                      <ClipboardList size={14} style={{verticalAlign:'middle',marginRight:3}} />Prontuário
                                    </Link>
                                    <button
                                      className="btn-card btn-avancar"
                                      onClick={() => avancarEstacao(item.id)}
                                      title="Avançar para próxima estação"
                                    >
                                      <ArrowRight size={14} style={{verticalAlign:'middle',marginRight:3}} />Avançar
                                    </button>
                                  </>
                                )}

                                {!estacao.isAtendimento && (
                                  <Link
                                    to={`/prontuario/${item.paciente_id}`}
                                    className="btn-card btn-prontuario"
                                    title="Abrir prontuário"
                                  >
                                    <ClipboardList size={14} style={{verticalAlign:'middle',marginRight:3}} />Prontuário
                                  </Link>
                                )}

                                {canManage && (
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
              )}
            </div>
          )
        })}
      </div>

      {/* Modal: Adicionar à Fila */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adicionar Paciente à Fila</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="busca-paciente">Buscar paciente</label>
                <input
                  id="busca-paciente"
                  type="text"
                  placeholder="Digite nome ou CPF..."
                  value={searchPaciente}
                  onChange={(e) => buscarPacientes(e.target.value)}
                  autoFocus
                />
              </div>

              {searchLoading && <div className="loading-sm">Buscando...</div>}

              <div className="pacientes-lista">
                {pacientesDisponiveis.map((p) => (
                  <div className="paciente-item" key={p.id} onClick={() => adicionarNaFila(p.id)}>
                    <div>
                      <strong>{p.nome_completo}</strong>
                      {p.cpf && <span className="paciente-cpf"> — {p.cpf}</span>}
                    </div>
                    {p.convenio && <span className="paciente-convenio">{p.convenio}</span>}
                  </div>
                ))}
                {searchPaciente.length >= 2 && !searchLoading && pacientesDisponiveis.length === 0 && (
                  <div className="pacientes-empty">Nenhum paciente disponível encontrado</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api.ts'
import { Search, ClipboardList, Pencil, Trash2, MapPin, Users, School, Zap } from 'lucide-react'
import './Pacientes.css'

interface FilaCheck {
  [pacienteId: number]: boolean
}

interface Paciente {
  id: number
  codigo: string
  nome_completo: string
  cpf: string | null
  telefone: string | null
  convenio: string | null
  data_nascimento: string | null
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  responsavel: string | null
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface FilaInfo {
  filaId: number
  estacao: string
  status: string
  prioridade: number
}

export default function PacientesList() {
  const [searchParams] = useSearchParams()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [naFila, setNaFila] = useState<FilaCheck>({})
  const [filaInfo, setFilaInfo] = useState<Record<number, FilaInfo>>({})
  const [checkingIn, setCheckingIn] = useState<number | null>(null)
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
  const [searched, setSearched] = useState(false)
  const [escolaDia, setEscolaDia] = useState(false)
  const [escolasHoje, setEscolasHoje] = useState<{ escola: string; total: number }[]>([])

  const fetchPacientes = useCallback(async (page = 1, searchTerm = '', filterEscolaDia = escolaDia) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (searchTerm) params.search = searchTerm
      if (filterEscolaDia) params.escola_dia = 1
      const res = await api.get('/pacientes', { params })
      setPacientes(res.data.data)
      setPagination(res.data.pagination)
    } catch {
      console.error('Erro ao carregar pacientes')
    } finally {
      setLoading(false)
    }
  }, [escolaDia])

  const checkFilaStatus = useCallback(async () => {
    try {
      const res = await api.get('/fila')
      const ids: FilaCheck = {}
      const info: Record<number, FilaInfo> = {}
      Object.entries(res.data).forEach(([estacao, items]) => {
        (items as { id: number; paciente_id: number; status: string; prioridade: number }[]).forEach((item) => {
          ids[item.paciente_id] = true
          info[item.paciente_id] = { filaId: item.id, estacao, status: item.status, prioridade: item.prioridade }
        })
      })
      setNaFila(ids)
      setFilaInfo(info)
    } catch { /* ignore */ }
  }, [])

  const toggleRow = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const ESTACAO_LABELS: Record<string, string> = {
    acuidade: 'Acuidade', exames: 'Exames', laudos: 'Laudos', oculos: 'Óculos',
    altas: 'Alta', encaminhamentos: 'Encaminhado'
  }

  useEffect(() => {
    checkFilaStatus()
    // Fetch today's schools
    api.get('/escola-agenda/hoje').then(res => {
      setEscolasHoje(res.data.escolas ?? [])
    }).catch(() => {})
  }, [checkFilaStatus])

  useEffect(() => {
    const searchParam = searchParams.get('search')
    if (searchParam) {
      setSearch(searchParam)
      setSearched(true)
      fetchPacientes(1, searchParam)
    }
  }, [searchParams, fetchPacientes])

  const handleLoadAll = () => {
    setSearch('')
    setSearched(true)
    fetchPacientes(1, '', escolaDia)
  }

  const handleSearch = () => {
    if (!search.trim()) {
      setSearched(false)
      setPacientes([])
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 })
      return
    }
    setSearched(true)
    fetchPacientes(1, search, escolaDia)
  }

  const handleToggleEscolaDia = () => {
    const next = !escolaDia
    setEscolaDia(next)
    if (searched || search.trim()) {
      setSearched(true)
      fetchPacientes(1, search, next)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (!value.trim()) {
      setSearched(false)
      setPacientes([])
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 })
    }
  }

  const handleDelete = async (id: number, nome: string) => {
    if (!window.confirm(`Deseja realmente excluir o paciente "${nome}"?`)) return
    try {
      await api.delete(`/pacientes/${id}`)
      fetchPacientes(pagination.page, search)
    } catch {
      alert('Erro ao excluir paciente')
    }
  }

  const handleCheckIn = async (pacienteId: number, prioridade = 0) => {
    setCheckingIn(pacienteId)
    try {
      await api.post('/fila', { paciente_id: pacienteId, prioridade })
      setNaFila(prev => ({ ...prev, [pacienteId]: true }))
      checkFilaStatus()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao marcar presença'
      alert(msg)
    } finally {
      setCheckingIn(null)
    }
  }

  const handleTogglePrioridade = async (pacienteId: number) => {
    const info = filaInfo[pacienteId]
    if (!info) {
      handleCheckIn(pacienteId, 1)
      return
    }
    try {
      await api.put(`/fila/${info.filaId}/prioridade`)
      checkFilaStatus()
    } catch {
      alert('Erro ao alterar prioridade')
    }
  }

  return (
    <div className="pacientes-page">
      <div className="page-header">
        <Link to="/pacientes/novo" className="btn btn-primary">
          + Novo Paciente
        </Link>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou código..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSearch} className="btn btn-secondary">Buscar</button>
        <button onClick={handleLoadAll} className="btn btn-secondary"><Users size={14} style={{verticalAlign:'middle',marginRight:4}} />Todos Pacientes</button>
        <button
          onClick={handleToggleEscolaDia}
          className={`btn btn-escola-dia ${escolaDia ? 'active' : ''}`}
          title={escolasHoje.map(e => e.escola).join(', ') || 'Nenhuma escola agendada hoje'}
        >
          <School size={14} style={{verticalAlign:'middle',marginRight:4}} />
          Escola do Dia
        </button>
      </div>

      {escolaDia && escolasHoje.length > 0 && (
        <div className="escola-dia-info">
          <School size={14} />
          <span>Filtrando por escolas de hoje:</span>
          {escolasHoje.map((e, i) => (
            <span key={i} className="escola-dia-tag">{e.escola} ({e.total})</span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : !searched ? (
        <div className="empty-state-box"><Search size={32} /><span>Pesquise por nome, CPF ou código para encontrar um paciente</span></div>
      ) : (
        <>
          <div className="pacientes-drawer-list">
            {pacientes.length === 0 ? (
              <div className="empty-state-box">Nenhum paciente encontrado</div>
            ) : (
              pacientes.map((p) => {
                const isOpen = !!expandedRows[p.id]
                const fInfo = filaInfo[p.id]
                return (
                  <div className={`pac-drawer ${isOpen ? 'open' : ''} ${naFila[p.id] ? 'na-fila' : ''}`} key={p.id}>
                    <div className="pac-drawer-header" onClick={() => toggleRow(p.id)}>
                      <span className={`pac-chevron ${isOpen ? '' : 'chevron-collapsed'}`}>▼</span>
                      <span className="pac-codigo">#{p.codigo}</span>
                      <strong className="pac-nome">{p.nome_completo}</strong>
                      {naFila[p.id] && fInfo && (
                        <span className={`pac-fila-badge${fInfo.status === 'concluido' ? ' pac-fila-concluido' : ''}`}>
                          <MapPin size={14} style={{verticalAlign:'middle',marginRight:3}} />{ESTACAO_LABELS[fInfo.estacao] || fInfo.estacao}
                          {fInfo.status === 'em_atendimento' && ' — Em atendimento'}
                          {fInfo.status === 'concluido' && ' — Finalizado'}
                        </span>
                      )}
                      <div className="pac-drawer-right">
                        <button
                          className={`btn btn-sm btn-checkin-priority ${filaInfo[p.id]?.prioridade > 0 ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleTogglePrioridade(p.id) }}
                          disabled={checkingIn === p.id}
                          title={filaInfo[p.id]?.prioridade > 0 ? 'Remover prioridade' : naFila[p.id] ? 'Ativar prioridade' : 'Marcar presença com prioridade'}
                        >
                          <Zap size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-checkin"
                          onClick={(e) => { e.stopPropagation(); handleCheckIn(p.id) }}
                          disabled={!!naFila[p.id] || checkingIn === p.id}
                          title={naFila[p.id] ? 'Já está na fila' : 'Marcar presença'}
                        >
                          {naFila[p.id] ? '✓ Na fila' : checkingIn === p.id ? '...' : '✓ Presente'}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="pac-drawer-body">
                        <div className="pac-drawer-grid">
                          <div className="pac-drawer-field">
                            <span className="pac-field-label">Código</span>
                            <span className="pac-field-value">#{p.codigo}</span>
                          </div>
                          <div className="pac-drawer-field">
                            <span className="pac-field-label">CPF</span>
                            <span className="pac-field-value">{p.cpf || '—'}</span>
                          </div>
                          <div className="pac-drawer-field">
                            <span className="pac-field-label">Telefone</span>
                            <span className="pac-field-value">{p.telefone || '—'}</span>
                          </div>
                          <div className="pac-drawer-field">
                            <span className="pac-field-label">Convênio</span>
                            <span className="pac-field-value">{p.convenio || '—'}</span>
                          </div>
                          <div className="pac-drawer-field">
                            <span className="pac-field-label">Nascimento</span>
                            <span className="pac-field-value">{p.data_nascimento ? new Date(p.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                          </div>
                          <div className="pac-drawer-field span-2">
                            <span className="pac-field-label">Endereço</span>
                            <span className="pac-field-value">
                              {p.rua ? `${p.rua}, ${p.numero}${p.complemento ? ', ' + p.complemento : ''} — ${p.bairro}, ${p.cidade} - ${p.estado}` : '—'}
                            </span>
                          </div>
                          {p.cep && (
                            <div className="pac-drawer-field">
                              <span className="pac-field-label">CEP</span>
                              <span className="pac-field-value">{p.cep}</span>
                            </div>
                          )}
                          {p.responsavel && (
                            <div className="pac-drawer-field">
                              <span className="pac-field-label">Responsável</span>
                              <span className="pac-field-value">{p.responsavel}</span>
                            </div>
                          )}
                        </div>
                        <div className="pac-drawer-actions">
                          <Link to={`/prontuario/${p.id}`} className="btn btn-sm btn-primary"><ClipboardList size={14} style={{verticalAlign:'middle',marginRight:4}} />Prontuário</Link>
                          <Link to={`/pacientes/${p.id}/editar`} className="btn btn-sm btn-secondary"><Pencil size={14} style={{verticalAlign:'middle',marginRight:4}} />Editar</Link>
                          <button onClick={() => handleDelete(p.id, p.nome_completo)} className="btn btn-sm btn-danger"><Trash2 size={14} style={{verticalAlign:'middle',marginRight:4}} />Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => fetchPacientes(pagination.page - 1, search, escolaDia)}
                disabled={pagination.page <= 1}
                className="btn btn-sm btn-secondary"
              >
                Anterior
              </button>
              <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)</span>
              <button
                onClick={() => fetchPacientes(pagination.page + 1, search, escolaDia)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-sm btn-secondary"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

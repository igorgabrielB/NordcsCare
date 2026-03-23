import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'
import { RefreshCw, ExternalLink, Camera, CheckCircle2, Clock, XCircle, AlertCircle, Users, Search } from 'lucide-react'

interface RedCheckLaudo {
  id: number
  tipo_exame: string
  olho: string
  status: string
  diabetico: boolean
  observacao: string
  data: string
  link_resultado: string | null
  public_url: string | null
  paciente_nome: string
}

interface DemoPaciente {
  redcheck_id: number
  nome: string
  cpf: string
  tipos_exame: string
}

interface Props {
  pacienteId: number
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export default function RedCheckExames({ pacienteId, onSuccess, onError }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [laudos, setLaudos] = useState<RedCheckLaudo[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [demoPacientes, setDemoPacientes] = useState<DemoPaciente[]>([])
  const [selectedDemo, setSelectedDemo] = useState<string>('')
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [demoSearch, setDemoSearch] = useState('')

  const filteredDemoPacientes = useMemo(() => {
    if (!demoSearch.trim()) return demoPacientes
    const term = demoSearch.toLowerCase()
    return demoPacientes.filter(p =>
      p.nome.toLowerCase().includes(term) || p.cpf.includes(term)
    )
  }, [demoPacientes, demoSearch])

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/redcheck/status')
      setConfigured(data.configured)
    } catch {
      setConfigured(false)
    }
  }, [])

  const loadExames = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/redcheck/exames/${pacienteId}`)
      setLaudos(data.laudos || [])
      setMessage(data.message || '')
    } catch {
      setLaudos([])
    } finally {
      setLoading(false)
    }
  }, [pacienteId])

  const loadDemoPacientes = useCallback(async () => {
    try {
      const { data } = await api.get('/redcheck/recentes')
      setDemoPacientes(data.pacientes || [])
    } catch { /* ignore */ }
  }, [])

  async function loadDemoExames(redcheckId: string) {
    setSelectedDemo(redcheckId)
    if (!redcheckId) {
      loadExames()
      return
    }
    setLoadingDemo(true)
    try {
      const { data } = await api.get(`/redcheck/exames-demo/${redcheckId}`)
      setLaudos(data.laudos || [])
      setMessage('')
    } catch {
      setLaudos([])
    } finally {
      setLoadingDemo(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (configured) {
      loadExames()
      loadDemoPacientes()
    }
  }, [configured, loadExames, loadDemoPacientes])

  function handleRefresh() {
    if (selectedDemo) {
      loadDemoExames(selectedDemo)
    } else {
      loadExames()
    }
    onSuccess?.('Exames atualizados')
  }

  function openResult(laudo: RedCheckLaudo) {
    const url = laudo.link_resultado || laudo.public_url
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      onError?.('Link do resultado não disponível')
    }
  }

  function statusIcon(status: string) {
    switch (status) {
      case 'diagnosticado': return <CheckCircle2 size={14} style={{ color: '#38a169' }} />
      case 'pendente': return <Clock size={14} style={{ color: '#d69e2e' }} />
      case 'bloqueado': return <XCircle size={14} style={{ color: '#e53e3e' }} />
      default: return <AlertCircle size={14} />
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'diagnosticado': return 'Diagnosticado'
      case 'pendente': return 'Aguardando Laudo'
      case 'bloqueado': return 'Bloqueado'
      default: return status
    }
  }

  if (configured === null) return null
  if (configured === false) return null

  return (
    <div className="redcheck-section section-card">
      <div className="redcheck-header">
        <h2 className="section-title">
          <Camera size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          RedCheck — Exames de Imagem
        </h2>
        <div className="redcheck-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={loading || loadingDemo}
            title="Atualizar exames da RedCheck"
          >
            <RefreshCw size={14} className={loading || loadingDemo ? 'spin' : ''} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {loading || loadingDemo ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {demoPacientes.length > 0 && (
        <div className="redcheck-demo-select" style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Demo: {demoPacientes.length} pacientes com SpotVision / Retinografia
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={demoSearch}
                onChange={e => setDemoSearch(e.target.value)}
                placeholder="Buscar paciente por nome ou CPF..."
                style={{ width: '100%', padding: '6px 10px 6px 28px', borderRadius: 'var(--radius, 8px)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>
            {selectedDemo && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSelectedDemo(''); setDemoSearch(''); loadExames() }}
                style={{ whiteSpace: 'nowrap' }}
              >
                Voltar ao paciente atual
              </button>
            )}
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 6, border: '1px solid var(--border)', borderRadius: 'var(--radius, 8px)', background: 'var(--bg-page)' }}>
            {filteredDemoPacientes.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: '0.83rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Nenhum paciente encontrado</div>
            )}
            {filteredDemoPacientes.slice(0, 50).map(p => (
              <div
                key={p.redcheck_id}
                onClick={() => { setSelectedDemo(String(p.redcheck_id)); loadDemoExames(String(p.redcheck_id)) }}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  background: selectedDemo === String(p.redcheck_id) ? 'var(--primary)' : 'transparent',
                  ...(selectedDemo === String(p.redcheck_id) ? { color: '#fff' } : {})
                }}
                onMouseEnter={e => { if (selectedDemo !== String(p.redcheck_id)) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                onMouseLeave={e => { if (selectedDemo !== String(p.redcheck_id)) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <strong>{p.nome}</strong>{p.cpf ? ` — CPF: ${p.cpf}` : ''}
                {p.tipos_exame && <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}>({p.tipos_exame})</span>}
              </div>
            ))}
            {filteredDemoPacientes.length > 50 && (
              <div style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                ...e mais {filteredDemoPacientes.length - 50} pacientes. Filtre para refinar.
              </div>
            )}
          </div>
        </div>
      )}

      {message && laudos.length === 0 && (
        <p className="empty-msg" style={{ marginTop: 8, fontStyle: 'italic' }}>{message}</p>
      )}

      {laudos.length > 0 && (
        <div className="redcheck-laudos">
          {laudos.map(l => (
            <div key={l.id} className={`redcheck-laudo-item redcheck-status-${l.status}`}>
              <div className="redcheck-laudo-info">
                <span className="redcheck-laudo-tipo">{l.tipo_exame}</span>
                <span className="redcheck-laudo-olho">{l.olho}</span>
                <span className="redcheck-laudo-status">
                  {statusIcon(l.status)} {statusLabel(l.status)}
                </span>
                {l.diabetico && <span className="redcheck-laudo-tag">Diabético</span>}
                <span className="redcheck-laudo-data">
                  {l.data ? new Date(l.data).toLocaleDateString('pt-BR') : ''}
                </span>
              </div>
              <div className="redcheck-laudo-actions">
                {(l.link_resultado || l.public_url) && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => openResult(l)}
                    title="Ver resultado na RedCheck"
                  >
                    <ExternalLink size={14} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    Ver Resultado
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {laudos.length === 0 && !message && !loading && (
        <p className="empty-msg" style={{ marginTop: 8 }}>
          Nenhum exame encontrado na RedCheck para este paciente.
        </p>
      )}

      {loading && laudos.length === 0 && (
        <p className="empty-msg" style={{ marginTop: 8 }}>Buscando exames na RedCheck...</p>
      )}
    </div>
  )
}
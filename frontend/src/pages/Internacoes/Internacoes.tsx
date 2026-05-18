import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  BedDouble, Plus, Search, X, RefreshCw, ArrowRightLeft,
  LogOut, ClipboardList, ChevronDown, Filter, Clock,
  User, Stethoscope, Edit2, Trash2, BarChart2, AlertCircle,
  CheckCircle, Activity, FileText, Save,
} from 'lucide-react'
import api from '../../services/api.ts'
import IOSDatePicker from '../../components/IOSDatePicker/IOSDatePicker.tsx'
import TimeWheelPicker from '../../components/TimeWheelPicker/TimeWheelPicker.tsx'
import './Internacoes.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type LeitoStatus = 'livre' | 'ocupado' | 'higienizacao' | 'reservado'
type LeitoTipo   = 'enfermaria' | 'apartamento' | 'uti' | 'semi_uti'
type InternStatus = 'ativo' | 'alta' | 'transferido' | 'obito'
type EvolTipo    = 'medica' | 'enfermagem' | 'fisioterapia' | 'nutricao' | 'outro'

interface Leito {
  id: number
  codigo: string
  nome: string | null
  ala: string | null
  andar: string | null
  tipo: LeitoTipo
  status: LeitoStatus
  observacoes: string | null
  internacao_id: number | null
  paciente_nome: string | null
  paciente_id: number | null
}

interface Internacao {
  id: number
  paciente_id: number
  paciente_nome: string
  data_nascimento: string | null
  idade?: number
  leito_id: number
  leito_codigo: string
  ala: string | null
  andar: string | null
  leito_tipo: LeitoTipo
  medico_id: number | null
  medico_nome: string | null
  usuario_nome: string
  data_admissao: string
  data_alta: string | null
  motivo_internacao: string
  diagnostico: string | null
  convenio: string | null
  numero_autorizacao: string | null
  observacoes: string | null
  status: InternStatus
  evolucoes?: Evolucao[]
}

interface Evolucao {
  id: number
  tipo: EvolTipo
  texto: string
  autor: string
  created_at: string
}

interface Stats {
  total_leitos: number
  leitos_status: Record<string, number>
  leitos_por_tipo: Array<{ tipo: string; total: number; ocupados: number }>
  internacoes_ativas: number
  tempo_medio_horas: number
}

interface Paciente { id: number; nome_completo: string; codigo: string | null }
interface Medico   { id: number; nome: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LEITO: Record<LeitoStatus, { label: string; cor: string }> = {
  livre:        { label: 'Livre',        cor: '#38a169' },
  ocupado:      { label: 'Ocupado',      cor: '#e53e3e' },
  higienizacao: { label: 'Higienização', cor: '#dd6b20' },
  reservado:    { label: 'Reservado',    cor: '#3182ce' },
}

const TIPO_LEITO: Record<LeitoTipo, { label: string; cor: string }> = {
  enfermaria:  { label: 'Enfermaria',  cor: '#4a90d9' },
  apartamento: { label: 'Apartamento', cor: '#805ad5' },
  uti:         { label: 'UTI',         cor: '#e53e3e' },
  semi_uti:    { label: 'Semi-UTI',    cor: '#dd6b20' },
}

const EVOL_TIPO: Record<EvolTipo, string> = {
  medica:       'Médica',
  enfermagem:   'Enfermagem',
  fisioterapia: 'Fisioterapia',
  nutricao:     'Nutrição',
  outro:        'Outro',
}

function duracao(dataAdmissao: string): string {
  const diff = Date.now() - new Date(dataAdmissao).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function fmtHora(dt: string): string {
  return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Modal: Gerenciar Leito ───────────────────────────────────────────────────

interface LeitoModalProps {
  leito?: Leito | null
  onClose: () => void
  onSaved: () => void
}
function LeitoModal({ leito, onClose, onSaved }: LeitoModalProps) {
  const [form, setForm] = useState({
    codigo:      leito?.codigo || '',
    nome:        leito?.nome || '',
    ala:         leito?.ala || '',
    andar:       leito?.andar || '',
    tipo:        (leito?.tipo || 'enfermaria') as LeitoTipo,
    status:      (leito?.status || 'livre') as LeitoStatus,
    observacoes: leito?.observacoes || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.codigo.trim()) { setErr('Código é obrigatório'); return }
    setSaving(true); setErr('')
    try {
      if (leito) await api.put(`/leitos/${leito.id}`, form)
      else        await api.post('/leitos', form)
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Erro ao salvar leito')
    } finally { setSaving(false) }
  }

  return (
    <div className="int-modal-overlay" onClick={onClose}>
      <div className="int-modal" onClick={e => e.stopPropagation()}>
        <div className="int-modal-header">
          <h3>{leito ? 'Editar Leito' : 'Novo Leito'}</h3>
          <button className="int-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="int-modal-body">
          {err && <div className="int-error-bar">{err}</div>}
          <div className="int-form-row">
            <label>Código *
              <input value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="ex: A-101" maxLength={20}/>
            </label>
            <label>Nome
              <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="ex: Leito 101"/>
            </label>
          </div>
          <div className="int-form-row">
            <label>Ala
              <input value={form.ala} onChange={e => set('ala', e.target.value)} placeholder="ex: Clínica Médica"/>
            </label>
            <label>Andar
              <input value={form.andar} onChange={e => set('andar', e.target.value)} placeholder="ex: 2º andar"/>
            </label>
          </div>
          <div className="int-form-row">
            <label>Tipo
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {Object.entries(TIPO_LEITO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_LEITO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          </div>
          <label>Observações
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2}/>
          </label>
          <div className="int-modal-actions">
            <button type="button" className="int-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="int-btn-primary" disabled={saving}>
              <Save size={15}/>{saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Nova Internação ───────────────────────────────────────────────────

interface InternacaoModalProps {
  leitoPre?: Leito | null
  onClose: () => void
  onSaved: () => void
}
function InternacaoModal({ leitoPre, onClose, onSaved }: InternacaoModalProps) {
  const [pacSearch, setPacSearch]   = useState('')
  const [pacResults, setPacResults] = useState<Paciente[]>([])
  const [selectedPac, setSelectedPac] = useState<Paciente | null>(null)
  const [leitos, setLeitos]         = useState<Leito[]>([])
  const [medicos, setMedicos]       = useState<Medico[]>([])
  const [form, setForm] = useState({
    leito_id:            leitoPre?.id?.toString() || '',
    medico_id:           '',
    motivo_internacao:   '',
    diagnostico:         '',
    convenio:            '',
    numero_autorizacao:  '',
    observacoes:         '',
    data_admissao:       new Date().toISOString().slice(0, 16),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    api.get('/leitos?status=livre').then(r => setLeitos(r.data.data || []))
    api.get('/medicos').then(r => setMedicos(r.data.data || r.data || []))
  }, [])

  function searchPac(q: string) {
    setPacSearch(q)
    clearTimeout(searchTimer.current)
    if (!q.trim()) { setPacResults([]); return }
    searchTimer.current = setTimeout(async () => {
      const r = await api.get(`/pacientes?search=${encodeURIComponent(q)}&limit=8`)
      setPacResults(r.data.data || r.data || [])
    }, 300)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPac) { setErr('Selecione um paciente'); return }
    if (!form.leito_id) { setErr('Selecione um leito'); return }
    if (!form.motivo_internacao.trim()) { setErr('Motivo é obrigatório'); return }
    setSaving(true); setErr('')
    try {
      await api.post('/internacoes', {
        ...form,
        paciente_id: selectedPac.id,
        leito_id: parseInt(form.leito_id),
        medico_id: form.medico_id ? parseInt(form.medico_id) : null,
      })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Erro ao registrar internação')
    } finally { setSaving(false) }
  }

  return (
    <div className="int-modal-overlay" onClick={onClose}>
      <div className="int-modal int-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="int-modal-header">
          <h3>Nova Internação</h3>
          <button className="int-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="int-modal-body">
          {err && <div className="int-error-bar">{err}</div>}

          {/* Paciente */}
          <div className="int-section-title"><User size={14}/>Paciente</div>
          {!selectedPac ? (
            <div className="int-pac-search">
              <Search size={14}/>
              <input
                value={pacSearch}
                onChange={e => searchPac(e.target.value)}
                placeholder="Buscar paciente por nome ou código..."
                autoFocus
              />
              {pacResults.length > 0 && (
                <ul className="int-pac-results">
                  {pacResults.map(p => (
                    <li key={p.id} onClick={() => { setSelectedPac(p); setPacResults([]) }}>
                      <strong>{p.nome_completo}</strong>
                      {p.codigo && <span className="int-pac-code">{p.codigo}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="int-pac-selected">
              <div className="int-pac-avatar">{selectedPac.nome_completo.slice(0,2).toUpperCase()}</div>
              <div className="int-pac-info">
                <strong>{selectedPac.nome_completo}</strong>
                {selectedPac.codigo && <span>{selectedPac.codigo}</span>}
              </div>
              <button type="button" className="int-pac-clear" onClick={() => setSelectedPac(null)}><X size={14}/></button>
            </div>
          )}

          {/* Leito */}
          <div className="int-section-title" style={{ marginTop: '1rem' }}><BedDouble size={14}/>Leito</div>
          <div className="int-form-row">
            <label>Leito *
              <select value={form.leito_id} onChange={e => set('leito_id', e.target.value)} disabled={!!leitoPre}>
                <option value="">Selecione...</option>
                {leitos.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.codigo}{l.ala ? ` — ${l.ala}` : ''} ({TIPO_LEITO[l.tipo]?.label})
                  </option>
                ))}
              </select>
            </label>
            <label>Médico responsável
              <select value={form.medico_id} onChange={e => set('medico_id', e.target.value)}>
                <option value="">Selecione...</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
          </div>

          {/* Clínico */}
          <div className="int-section-title" style={{ marginTop: '1rem' }}><ClipboardList size={14}/>Dados Clínicos</div>
          <label>Motivo da internação *
            <textarea value={form.motivo_internacao} onChange={e => set('motivo_internacao', e.target.value)} rows={2}/>
          </label>
          <label>Diagnóstico
            <input value={form.diagnostico} onChange={e => set('diagnostico', e.target.value)} placeholder="CID ou descrição"/>
          </label>
          <div className="int-form-row">
            <div className="int-label-group">
              <span className="int-field-label">Data de admissão</span>
              <IOSDatePicker
                value={form.data_admissao.slice(0, 10)}
                onChange={d => set('data_admissao', d + 'T' + (form.data_admissao.slice(11) || '00:00'))}
                label="Data de Admissão"
                placeholder="Selecionar data"
              />
            </div>
            <div className="int-label-group">
              <span className="int-field-label">Hora de admissão</span>
              <TimeWheelPicker
                value={form.data_admissao.slice(11, 16)}
                onChange={t => set('data_admissao', (form.data_admissao.slice(0, 10) || new Date().toISOString().slice(0, 10)) + 'T' + t)}
              />
            </div>
          </div>
          <div className="int-form-row">
            <label>Convênio
              <input value={form.convenio} onChange={e => set('convenio', e.target.value)} placeholder="ex: Unimed"/>
            </label>
            <label>Nº Autorização
              <input value={form.numero_autorizacao} onChange={e => set('numero_autorizacao', e.target.value)}/>
            </label>
          </div>
          <label>Observações
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2}/>
          </label>

          <div className="int-modal-actions">
            <button type="button" className="int-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="int-btn-primary" disabled={saving}>
              <Save size={15}/>{saving ? 'Salvando...' : 'Internar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Alta / Transferência ─────────────────────────────────────────────

interface AltaModalProps {
  internacao: Internacao
  onClose: () => void
  onSaved: () => void
}
function AltaModal({ internacao, onClose, onSaved }: AltaModalProps) {
  const [status, setStatus]   = useState<'alta' | 'transferido' | 'obito'>('alta')
  const [dataAlta, setDataAlta] = useState(new Date().toISOString().slice(0, 16))
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.post(`/internacoes/${internacao.id}/alta`, { status, data_alta: dataAlta })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Erro ao dar alta')
    } finally { setSaving(false) }
  }

  return (
    <div className="int-modal-overlay" onClick={onClose}>
      <div className="int-modal" onClick={e => e.stopPropagation()}>
        <div className="int-modal-header">
          <h3>Dar Alta — {internacao.paciente_nome}</h3>
          <button className="int-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="int-modal-body">
          {err && <div className="int-error-bar">{err}</div>}
          <p className="int-alta-info">
            Leito: <strong>{internacao.leito_codigo}</strong> · Admissão: <strong>{fmtHora(internacao.data_admissao)}</strong>
          </p>
          <div className="int-alta-options">
            {(['alta','transferido','obito'] as const).map(s => (
              <button
                key={s}
                type="button"
                className={`int-alta-opt${status === s ? ' active' : ''}`}
                data-s={s}
                onClick={() => setStatus(s)}
              >
                {s === 'alta' ? '✓ Alta Médica' : s === 'transferido' ? '→ Transferência' : '✝ Óbito'}
              </button>
            ))}
          </div>
          <div className="int-form-row">
            <div className="int-label-group">
              <span className="int-field-label">Data da alta</span>
              <IOSDatePicker
                value={dataAlta.slice(0, 10)}
                onChange={d => setDataAlta(d + 'T' + (dataAlta.slice(11) || '00:00'))}
                label="Data da Alta"
                placeholder="Selecionar data"
              />
            </div>
            <div className="int-label-group">
              <span className="int-field-label">Hora da alta</span>
              <TimeWheelPicker
                value={dataAlta.slice(11, 16)}
                onChange={t => setDataAlta((dataAlta.slice(0, 10) || new Date().toISOString().slice(0, 10)) + 'T' + t)}
              />
            </div>
          </div>
          <div className="int-modal-actions">
            <button type="button" className="int-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="int-btn-primary" disabled={saving}>
              <CheckCircle size={15}/>{saving ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Transferir Leito ──────────────────────────────────────────────────

interface TransferirModalProps {
  internacao: Internacao
  onClose: () => void
  onSaved: () => void
}
function TransferirModal({ internacao, onClose, onSaved }: TransferirModalProps) {
  const [leitos, setLeitos]     = useState<Leito[]>([])
  const [novoLeito, setNovoLeito] = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    api.get('/leitos?status=livre').then(r => setLeitos((r.data.data || []).filter((l: Leito) => l.id !== internacao.leito_id)))
  }, [internacao.leito_id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoLeito) { setErr('Selecione o novo leito'); return }
    setSaving(true); setErr('')
    try {
      await api.post(`/internacoes/${internacao.id}/transferir`, { novo_leito_id: parseInt(novoLeito) })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Erro ao transferir')
    } finally { setSaving(false) }
  }

  return (
    <div className="int-modal-overlay" onClick={onClose}>
      <div className="int-modal" onClick={e => e.stopPropagation()}>
        <div className="int-modal-header">
          <h3>Transferir Leito — {internacao.paciente_nome}</h3>
          <button className="int-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="int-modal-body">
          {err && <div className="int-error-bar">{err}</div>}
          <p className="int-alta-info">Leito atual: <strong>{internacao.leito_codigo}</strong></p>
          <label>Novo leito *
            <select value={novoLeito} onChange={e => setNovoLeito(e.target.value)} autoFocus>
              <option value="">Selecione um leito livre...</option>
              {leitos.map(l => (
                <option key={l.id} value={l.id}>
                  {l.codigo}{l.ala ? ` — ${l.ala}` : ''} ({TIPO_LEITO[l.tipo]?.label})
                </option>
              ))}
            </select>
          </label>
          {leitos.length === 0 && <p className="int-no-leitos">Nenhum leito livre disponível.</p>}
          <div className="int-modal-actions">
            <button type="button" className="int-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="int-btn-primary" disabled={saving || !leitos.length}>
              <ArrowRightLeft size={15}/>{saving ? 'Transferindo...' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Evolução ──────────────────────────────────────────────────────────

interface EvolucaoModalProps {
  internacao: Internacao
  onClose: () => void
  onSaved: () => void
}
function EvolucaoModal({ internacao, onClose, onSaved }: EvolucaoModalProps) {
  const [tipo, setTipo]   = useState<EvolTipo>('medica')
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) { setErr('Texto é obrigatório'); return }
    setSaving(true); setErr('')
    try {
      await api.post(`/internacoes/${internacao.id}/evolucoes`, { tipo, texto })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Erro ao salvar evolução')
    } finally { setSaving(false) }
  }

  return (
    <div className="int-modal-overlay" onClick={onClose}>
      <div className="int-modal" onClick={e => e.stopPropagation()}>
        <div className="int-modal-header">
          <h3>Nova Evolução — {internacao.paciente_nome}</h3>
          <button className="int-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="int-modal-body">
          {err && <div className="int-error-bar">{err}</div>}
          <label>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value as EvolTipo)}>
              {Object.entries(EVOL_TIPO).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Evolução *
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={6}
              placeholder="Descreva a evolução clínica do paciente..."
              autoFocus
            />
          </label>
          <div className="int-modal-actions">
            <button type="button" className="int-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="int-btn-primary" disabled={saving}>
              <FileText size={15}/>{saving ? 'Salvando...' : 'Registrar Evolução'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Detalhe da Internação ─────────────────────────────────────────────

interface DetalheModalProps {
  internacaoId: number
  onClose: () => void
  onAction: () => void
}
function DetalheModal({ internacaoId, onClose, onAction }: DetalheModalProps) {
  const [intern, setIntern]   = useState<Internacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEvol, setShowEvol] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/internacoes/${internacaoId}`)
      setIntern(r.data.data)
    } finally { setLoading(false) }
  }, [internacaoId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="int-modal-overlay">
      <div className="int-modal int-modal-lg"><div className="int-loading"><RefreshCw size={20} className="spin"/>Carregando...</div></div>
    </div>
  )
  if (!intern) return null

  return (
    <div className="int-modal-overlay" onClick={onClose}>
      <div className="int-modal int-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="int-modal-header">
          <h3>Internação #{intern.id} — {intern.paciente_nome}</h3>
          <button className="int-modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="int-modal-body">
          <div className="int-detalhe-grid">
            <div className="int-detalhe-item"><span>Leito</span><strong>{intern.leito_codigo}{intern.ala ? ` · ${intern.ala}` : ''}</strong></div>
            <div className="int-detalhe-item"><span>Tipo</span><strong>{TIPO_LEITO[intern.leito_tipo]?.label}</strong></div>
            <div className="int-detalhe-item"><span>Admissão</span><strong>{fmtHora(intern.data_admissao)}</strong></div>
            <div className="int-detalhe-item"><span>Internado há</span><strong>{duracao(intern.data_admissao)}</strong></div>
            {intern.medico_nome && <div className="int-detalhe-item"><span>Médico</span><strong>{intern.medico_nome}</strong></div>}
            {intern.convenio    && <div className="int-detalhe-item"><span>Convênio</span><strong>{intern.convenio}</strong></div>}
            {intern.diagnostico && <div className="int-detalhe-item int-detalhe-full"><span>Diagnóstico</span><strong>{intern.diagnostico}</strong></div>}
            <div className="int-detalhe-item int-detalhe-full"><span>Motivo</span><strong>{intern.motivo_internacao}</strong></div>
            {intern.observacoes && <div className="int-detalhe-item int-detalhe-full"><span>Observações</span><strong>{intern.observacoes}</strong></div>}
          </div>

          {/* Evoluções */}
          <div className="int-evol-section">
            <div className="int-evol-header">
              <span><Activity size={14}/> Evoluções ({intern.evolucoes?.length || 0})</span>
              {intern.status === 'ativo' && (
                <button className="int-btn-sm" onClick={() => setShowEvol(true)}>
                  <Plus size={12}/>Nova Evolução
                </button>
              )}
            </div>
            <div className="int-evol-list">
              {(!intern.evolucoes || intern.evolucoes.length === 0) && (
                <p className="int-evol-empty">Nenhuma evolução registrada.</p>
              )}
              {intern.evolucoes?.map(ev => (
                <div key={ev.id} className="int-evol-item">
                  <div className="int-evol-meta">
                    <span className={`int-evol-tipo tipo-${ev.tipo}`}>{EVOL_TIPO[ev.tipo]}</span>
                    <span className="int-evol-autor">{ev.autor}</span>
                    <span className="int-evol-data">{fmtHora(ev.created_at)}</span>
                  </div>
                  <p className="int-evol-texto">{ev.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEvol && (
        <EvolucaoModal
          internacao={intern}
          onClose={() => setShowEvol(false)}
          onSaved={() => { setShowEvol(false); load(); onAction() }}
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'mapa' | 'ativas' | 'historico'
type FilterStatus = LeitoStatus | 'todos'

export default function Internacoes() {
  const [tab, setTab]           = useState<Tab>('mapa')
  const [leitos, setLeitos]     = useState<Leito[]>([])
  const [internacoes, setInternacoes] = useState<Internacao[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [filterAla, setFilterAla] = useState('')

  // Modais
  const [leitoModal, setLeitoModal]         = useState<{ leito?: Leito | null } | null>(null)
  const [internModal, setInternModal]       = useState<{ leito?: Leito | null } | null>(null)
  const [altaModal, setAltaModal]           = useState<Internacao | null>(null)
  const [transferModal, setTransferModal]   = useState<Internacao | null>(null)
  const [detalheId, setDetalheId]           = useState<number | null>(null)
  const [histStatus, setHistStatus]         = useState<InternStatus>('alta')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [lRes, iRes, sRes] = await Promise.all([
        api.get('/leitos'),
        api.get('/internacoes?status=ativo'),
        api.get('/internacoes/stats'),
      ])
      setLeitos(lRes.data.data || [])
      setInternacoes(iRes.data.data || [])
      setStats(sRes.data.data)
    } finally { setLoading(false) }
  }, [])

  const loadHist = useCallback(async (s: InternStatus) => {
    const r = await api.get(`/internacoes?status=${s}`)
    setInternacoes(r.data.data || [])
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  function switchTab(t: Tab) {
    setTab(t)
    if (t === 'ativas')    { api.get('/internacoes?status=ativo').then(r => setInternacoes(r.data.data || [])) }
    if (t === 'historico') { loadHist(histStatus) }
    if (t === 'mapa')      { api.get('/leitos').then(r => setLeitos(r.data.data || [])) }
  }

  // Agrupamento por ala
  const alas = Array.from(new Set(leitos.map(l => l.ala || 'Sem Ala'))).sort()
  const filteredLeitos = leitos.filter(l => {
    if (filterStatus !== 'todos' && l.status !== filterStatus) return false
    if (filterAla && (l.ala || 'Sem Ala') !== filterAla) return false
    return true
  })

  const leitosAgrupados: Record<string, Leito[]> = {}
  for (const l of filteredLeitos) {
    const k = l.ala || 'Sem Ala'
    if (!leitosAgrupados[k]) leitosAgrupados[k] = []
    leitosAgrupados[k].push(l)
  }

  function onSaved() {
    setLeitoModal(null); setInternModal(null); setAltaModal(null)
    setTransferModal(null); setDetalheId(null)
    loadAll()
    if (tab === 'historico') loadHist(histStatus)
  }

  return (
    <div className="int-page">
      {/* Header */}
      <div className="int-header">
        <div className="int-header-title">
          <div className="int-header-icon-wrap"><BedDouble size={22}/></div>
          <div>
            <h1>Internações</h1>
            <p>Gerenciamento de leitos e internações hospitalares</p>
          </div>
        </div>
        <div className="int-header-actions">
          <button className="int-btn-secondary" onClick={() => setLeitoModal({ leito: null })}>
            <Plus size={15}/> Novo Leito
          </button>
          <button className="int-btn-primary" onClick={() => setInternModal({ leito: null })}>
            <Plus size={15}/> Nova Internação
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="int-stats">
          <div className="int-stat">
            <span className="int-stat-val">{stats.total_leitos}</span>
            <span className="int-stat-lbl">Total Leitos</span>
          </div>
          {Object.entries(STATUS_LEITO).map(([k, v]) => (
            <div key={k} className="int-stat" style={{ '--stat-c': v.cor } as React.CSSProperties}>
              <span className="int-stat-val">{stats.leitos_status[k] || 0}</span>
              <span className="int-stat-lbl">{v.label}</span>
            </div>
          ))}
          <div className="int-stat" style={{ '--stat-c': '#805ad5' } as React.CSSProperties}>
            <span className="int-stat-val">{stats.internacoes_ativas}</span>
            <span className="int-stat-lbl">Internações Ativas</span>
          </div>
          {stats.tempo_medio_horas > 0 && (
            <div className="int-stat">
              <span className="int-stat-val">{stats.tempo_medio_horas}h</span>
              <span className="int-stat-lbl">Tempo Médio</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="int-tabs">
        <button className={tab === 'mapa' ? 'active' : ''} onClick={() => switchTab('mapa')}>
          <BedDouble size={15}/> Mapa de Leitos
        </button>
        <button className={tab === 'ativas' ? 'active' : ''} onClick={() => switchTab('ativas')}>
          <Activity size={15}/> Internações Ativas
        </button>
        <button className={tab === 'historico' ? 'active' : ''} onClick={() => switchTab('historico')}>
          <ClipboardList size={15}/> Histórico
        </button>
        <button className="int-refresh-btn" onClick={loadAll} title="Atualizar">
          <RefreshCw size={15}/>
        </button>
      </div>

      {/* ── ABA: MAPA DE LEITOS ── */}
      {tab === 'mapa' && (
        <div className="int-mapa-container">
          {/* Filtros */}
          <div className="int-filtros">
            <div className="int-filtro-group">
              <Filter size={13}/>
              {(['todos', 'livre', 'ocupado', 'higienizacao', 'reservado'] as const).map(s => (
                <button
                  key={s}
                  className={`int-filtro-btn${filterStatus === s ? ' active' : ''}`}
                  style={s !== 'todos' ? { '--fc': STATUS_LEITO[s]?.cor } as React.CSSProperties : undefined}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === 'todos' ? 'Todos' : STATUS_LEITO[s].label}
                </button>
              ))}
            </div>
            {alas.length > 1 && (
              <select value={filterAla} onChange={e => setFilterAla(e.target.value)} className="int-filtro-ala">
                <option value="">Todas as alas</option>
                {alas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>

          {loading ? (
            <div className="int-loading"><RefreshCw size={20} className="spin"/>Carregando leitos...</div>
          ) : leitos.length === 0 ? (
            <div className="int-empty">
              <BedDouble size={40}/>
              <p>Nenhum leito cadastrado</p>
              <button className="int-btn-primary" onClick={() => setLeitoModal({ leito: null })}>
                <Plus size={15}/>Adicionar Leito
              </button>
            </div>
          ) : (
            Object.entries(leitosAgrupados).map(([ala, lts]) => (
              <div key={ala} className="int-ala-group">
                <div className="int-ala-title">
                  {ala}
                  <span className="int-ala-count">{lts.length}</span>
                </div>
                <div className="int-leitos-grid">
                  {lts.map(l => (
                    <div
                      key={l.id}
                      className={`int-leito-card status-${l.status}`}
                      style={{ '--lc': STATUS_LEITO[l.status].cor } as React.CSSProperties}
                    >
                      <div className="int-leito-header">
                        <span className="int-leito-codigo">{l.codigo}</span>
                        <span className="int-leito-tipo" style={{ background: TIPO_LEITO[l.tipo]?.cor }}>
                          {TIPO_LEITO[l.tipo]?.label}
                        </span>
                      </div>
                      <div className="int-leito-status">
                        <span className="int-status-dot" style={{ background: STATUS_LEITO[l.status].cor }}/>
                        {STATUS_LEITO[l.status].label}
                      </div>
                      {l.paciente_nome ? (
                        <div className="int-leito-paciente">
                          <User size={12}/>
                          <span>{l.paciente_nome}</span>
                        </div>
                      ) : (
                        <div className="int-leito-vazio">{l.nome || '—'}</div>
                      )}
                      <div className="int-leito-actions">
                        {l.status === 'livre' && (
                          <button
                            className="int-leito-btn primary"
                            onClick={() => setInternModal({ leito: l })}
                            title="Internar paciente"
                          >Internar</button>
                        )}
                        {l.status === 'ocupado' && l.internacao_id && (
                          <button
                            className="int-leito-btn view"
                            onClick={() => setDetalheId(l.internacao_id!)}
                            title="Ver internação"
                          >Ver</button>
                        )}
                        {l.status === 'higienizacao' && (
                          <button
                            className="int-leito-btn secondary"
                            onClick={() => api.put(`/leitos/${l.id}`, { status: 'livre' }).then(loadAll)}
                            title="Marcar como livre"
                          >Liberar</button>
                        )}
                        <button
                          className="int-leito-btn icon"
                          onClick={() => setLeitoModal({ leito: l })}
                          title="Editar leito"
                        ><Edit2 size={12}/></button>
                        {l.status === 'livre' && (
                          <button
                            className="int-leito-btn icon danger"
                            onClick={async () => {
                              if (!confirm(`Remover leito ${l.codigo}?`)) return
                              await api.delete(`/leitos/${l.id}`)
                              loadAll()
                            }}
                            title="Remover leito"
                          ><Trash2 size={12}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ABA: INTERNAÇÕES ATIVAS ── */}
      {tab === 'ativas' && (
        <div className="int-lista-container">
          {loading ? (
            <div className="int-loading"><RefreshCw size={20} className="spin"/>Carregando...</div>
          ) : internacoes.length === 0 ? (
            <div className="int-empty">
              <Activity size={40}/>
              <p>Nenhuma internação ativa no momento</p>
            </div>
          ) : (
            <table className="int-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Leito</th>
                  <th>Médico</th>
                  <th>Admissão</th>
                  <th>Internado há</th>
                  <th>Diagnóstico</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {internacoes.map(i => (
                  <tr key={i.id}>
                    <td>
                      <div className="int-table-pac">
                        <div className="int-pac-avatar sm">{i.paciente_nome.slice(0,2).toUpperCase()}</div>
                        <div>
                          <strong>{i.paciente_nome}</strong>
                          {i.idade && <small>{i.idade} anos</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="int-leito-badge" style={{ background: TIPO_LEITO[i.leito_tipo]?.cor }}>
                        {i.leito_codigo}
                      </span>
                      {i.ala && <small>{i.ala}</small>}
                    </td>
                    <td>{i.medico_nome || <span className="int-muted">—</span>}</td>
                    <td>{fmtHora(i.data_admissao)}</td>
                    <td><span className="int-duracao"><Clock size={12}/>{duracao(i.data_admissao)}</span></td>
                    <td>{i.diagnostico || <span className="int-muted">—</span>}</td>
                    <td>
                      <div className="int-row-actions">
                        <button onClick={() => setDetalheId(i.id)} title="Ver evoluções" className="int-action-btn view"><ClipboardList size={14}/></button>
                        <button onClick={() => setTransferModal(i)} title="Transferir leito" className="int-action-btn transfer"><ArrowRightLeft size={14}/></button>
                        <button onClick={() => setAltaModal(i)} title="Dar alta" className="int-action-btn alta"><LogOut size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ABA: HISTÓRICO ── */}
      {tab === 'historico' && (
        <div className="int-lista-container">
          <div className="int-hist-filtros">
            {(['alta','transferido','obito'] as const).map(s => (
              <button
                key={s}
                className={`int-filtro-btn${histStatus === s ? ' active' : ''}`}
                onClick={() => { setHistStatus(s); loadHist(s) }}
              >
                {s === 'alta' ? '✓ Altas' : s === 'transferido' ? '→ Transferências' : '✝ Óbitos'}
              </button>
            ))}
          </div>
          {internacoes.length === 0 ? (
            <div className="int-empty"><ClipboardList size={40}/><p>Nenhum registro encontrado</p></div>
          ) : (
            <table className="int-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Leito</th>
                  <th>Admissão</th>
                  <th>Alta / Saída</th>
                  <th>Permanência</th>
                  <th>Diagnóstico</th>
                  <th>Médico</th>
                </tr>
              </thead>
              <tbody>
                {internacoes.map(i => {
                  const perm = i.data_alta
                    ? (() => {
                        const h = Math.round((new Date(i.data_alta).getTime() - new Date(i.data_admissao).getTime()) / 3600000)
                        return h < 24 ? `${h}h` : `${Math.floor(h/24)}d ${h%24}h`
                      })()
                    : '—'
                  return (
                    <tr key={i.id}>
                      <td><strong>{i.paciente_nome}</strong>{i.idade && <small>{i.idade} anos</small>}</td>
                      <td><span className="int-leito-badge" style={{ background: TIPO_LEITO[i.leito_tipo]?.cor }}>{i.leito_codigo}</span></td>
                      <td>{fmtHora(i.data_admissao)}</td>
                      <td>{i.data_alta ? fmtHora(i.data_alta) : '—'}</td>
                      <td>{perm}</td>
                      <td>{i.diagnostico || '—'}</td>
                      <td>{i.medico_nome || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modais ── */}
      {leitoModal    && <LeitoModal    leito={leitoModal.leito} onClose={() => setLeitoModal(null)} onSaved={onSaved}/>}
      {internModal   && <InternacaoModal leitoPre={internModal.leito} onClose={() => setInternModal(null)} onSaved={onSaved}/>}
      {altaModal     && <AltaModal     internacao={altaModal}    onClose={() => setAltaModal(null)}     onSaved={onSaved}/>}
      {transferModal && <TransferirModal internacao={transferModal} onClose={() => setTransferModal(null)} onSaved={onSaved}/>}
      {detalheId !== null && (
        <DetalheModal internacaoId={detalheId} onClose={() => setDetalheId(null)} onAction={loadAll}/>
      )}
    </div>
  )
}

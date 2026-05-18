import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, CalendarDays, List, ChevronLeft, ChevronRight,
  CheckCircle, Bell, Pencil, Trash2, LogIn, X, Search,
  User, Stethoscope, Tag, Activity,
} from 'lucide-react'
import api from '../../services/api.ts'
import DatePicker from '../../components/DatePicker/DatePicker.tsx'
import TimeWheelPicker from '../../components/TimeWheelPicker/TimeWheelPicker.tsx'
import './Agendamentos.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Agendamento {
  id: number
  paciente_id: number
  medico_id: number | null
  especialidade_id: number
  data_hora: string
  duracao_min: number
  tipo: 'consulta' | 'retorno' | 'exame' | 'cirurgia' | 'triagem'
  status: 'agendado' | 'confirmado' | 'cancelado' | 'realizado' | 'falta'
  observacoes: string | null
  fila_id: number | null
  notificado_em: string | null
  paciente_nome: string
  paciente_telefone: string | null
  medico_nome: string | null
  especialidade_nome: string
  especialidade_cor: string
}

interface Especialidade { id: number; nome: string; cor: string }
interface Medico        { id: number; nome: string; crm: string; especialidade: string }
interface PacienteResult { id: number; nome_completo: string; cpf: string | null; telefone: string | null }

interface FormState {
  paciente_id: number | null
  especialidade_id: string
  medico_id: string
  data: string
  hora: string
  duracao_min: number
  tipo: string
  status: string
  observacoes: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const HOUR_START  = 7
const HOUR_END    = 19
const PX_PER_HOUR = 72

const TIPO_LABELS: Record<string, string> = {
  consulta: 'Consulta', retorno: 'Retorno', exame: 'Exame',
  cirurgia: 'Cirurgia', triagem: 'Triagem',
}
const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', cancelado: 'Cancelado',
  realizado: 'Realizado', falta: 'Falta',
}
const STATUS_CLASS: Record<string, string> = {
  agendado: 'badge--agendado', confirmado: 'badge--confirmado',
  cancelado: 'badge--cancelado', realizado: 'badge--realizado', falta: 'badge--falta',
}

const DURATIONS = [15, 20, 30, 45, 60, 90, 120]

function emptyForm(date = '', hora = '08:00'): FormState {
  return { paciente_id: null, especialidade_id: '', medico_id: '', data: date, hora, duracao_min: 30, tipo: 'consulta', status: 'agendado', observacoes: '' }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  r.setHours(0, 0, 0, 0)
  return r
}
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d })
}
function toDateStr(d: Date) { return d.toISOString().split('T')[0] }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmtDate(d: Date) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
function fmtDayName(d: Date) { return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') }
function fmtDateTime(dt: string) {
  const d = new Date(dt.replace(' ', 'T'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtTime(dt: string) {
  const d = new Date(dt.replace(' ', 'T'))
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function apptTopPx(dt: string): number {
  const d = new Date(dt.replace(' ', 'T'))
  return ((d.getHours() - HOUR_START) * 60 + d.getMinutes()) * (PX_PER_HOUR / 60)
}
function apptHeightPx(duracao: number): number {
  return Math.max(duracao, 30) * (PX_PER_HOUR / 60)
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Agendamentos() {
  const navigate = useNavigate()

  const [view, setView]               = useState<'lista' | 'semana'>('lista')
  const [weekDate, setWeekDate]       = useState<Date>(() => getMonday(new Date()))
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [medicos, setMedicos]         = useState<Medico[]>([])
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Filters (lista)
  const today = toDateStr(new Date())
  const [fDataI, setFDataI]   = useState(today)
  const [fDataF, setFDataF]   = useState(today)
  const [fEsp, setFEsp]       = useState('')
  const [fMedico, setFMedico] = useState('')
  const [fStatus, setFStatus] = useState('')

  // Modal
  const [showModal, setShowModal]   = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [form, setForm]             = useState<FormState>(emptyForm(today))

  // Patient autocomplete
  const [pacSearch, setPacSearch]         = useState('')
  const [pacResults, setPacResults]       = useState<PacienteResult[]>([])
  const [selectedPac, setSelectedPac]     = useState<PacienteResult | null>(null)
  const [pacLoading, setPacLoading]       = useState(false)
  const pacDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Medicos filtered by specialty (for modal)
  const [medicosFiltrados, setMedicosFiltrados] = useState<Medico[]>([])
  const modalBodyRef = useRef<HTMLDivElement>(null)

  // ── Fetches ──────────────────────────────────────────────────────────────────
  const fetchAgendamentos = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (view === 'lista') {
        if (fDataI) params.data_inicio = fDataI
        if (fDataF) params.data_fim    = fDataF
        if (fEsp)   params.especialidade_id = fEsp
        if (fMedico) params.medico_id  = fMedico
        if (fStatus) params.status     = fStatus
      } else {
        params.data_inicio = toDateStr(weekDate)
        const fim = new Date(weekDate); fim.setDate(fim.getDate() + 6)
        params.data_fim = toDateStr(fim)
      }
      const res = await api.get('/agendamentos', { params })
      setAgendamentos(res.data)
    } catch { setError('Erro ao carregar agendamentos') }
    finally { setLoading(false) }
  }, [view, weekDate, fDataI, fDataF, fEsp, fMedico, fStatus])

  useEffect(() => { fetchAgendamentos() }, [fetchAgendamentos])

  useEffect(() => {
    api.get('/especialidades').then(r => setEspecialidades(r.data)).catch(() => {})
    api.get('/medicos').then(r => setMedicos(r.data)).catch(() => {})
  }, [])

  // Filtrar médicos ao mudar especialidade no form
  useEffect(() => {
    if (!form.especialidade_id) { setMedicosFiltrados(medicos); return }
    api.get('/medicos', { params: { especialidade_id: form.especialidade_id } })
      .then(r => setMedicosFiltrados(r.data))
      .catch(() => setMedicosFiltrados(medicos))
  }, [form.especialidade_id, medicos])

  // Patient search debounce
  useEffect(() => {
    if (!pacSearch || pacSearch.length < 2) { setPacResults([]); return }
    if (pacDebounce.current) clearTimeout(pacDebounce.current)
    pacDebounce.current = setTimeout(async () => {
      setPacLoading(true)
      try {
        const r = await api.get('/pacientes', { params: { search: pacSearch, limit: 8 } })
        setPacResults(r.data.data ?? r.data)
      } catch { setPacResults([]) }
      finally { setPacLoading(false) }
    }, 300)
  }, [pacSearch])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openCreate = (date = today, hora = '08:00') => {
    setEditingId(null)
    setForm(emptyForm(date, hora))
    setSelectedPac(null)
    setPacSearch('')
    setPacResults([])
    setShowModal(true)
    setTimeout(() => modalBodyRef.current?.scrollTo(0, 0), 0)
  }

  const openEdit = (ag: Agendamento) => {
    const [datePart, timePart] = ag.data_hora.split(' ')
    const hora = timePart?.substring(0, 5) ?? '08:00'
    setEditingId(ag.id)
    setForm({
      paciente_id: ag.paciente_id,
      especialidade_id: String(ag.especialidade_id),
      medico_id: ag.medico_id ? String(ag.medico_id) : '',
      data: datePart, hora,
      duracao_min: ag.duracao_min,
      tipo: ag.tipo,
      status: ag.status,
      observacoes: ag.observacoes ?? '',
    })
    setSelectedPac({ id: ag.paciente_id, nome_completo: ag.paciente_nome, cpf: null, telefone: ag.paciente_telefone })
    setPacSearch(ag.paciente_nome)
    setShowModal(true)
    setTimeout(() => modalBodyRef.current?.scrollTo(0, 0), 0)
  }

  const handleSave = async () => {
    if (!form.paciente_id || !form.especialidade_id || !form.data || !form.hora) {
      setError('Preencha paciente, especialidade e data/hora')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        paciente_id:      form.paciente_id,
        especialidade_id: Number(form.especialidade_id),
        medico_id:        form.medico_id ? Number(form.medico_id) : null,
        data_hora:        `${form.data} ${form.hora}:00`,
        duracao_min:      form.duracao_min,
        tipo:             form.tipo,
        status:           form.status,
        observacoes:      form.observacoes || null,
      }
      if (editingId) {
        await api.put(`/agendamentos/${editingId}`, payload)
      } else {
        await api.post('/agendamentos', payload)
      }
      setShowModal(false)
      fetchAgendamentos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao salvar agendamento')
    } finally { setSaving(false) }
  }

  const handleConfirmar = async (id: number) => {
    try {
      await api.post(`/agendamentos/${id}/confirmar`)
      fetchAgendamentos()
    } catch { alert('Erro ao confirmar agendamento') }
  }

  const handleNotificar = async (id: number) => {
    try {
      await api.post(`/agendamentos/${id}/notificar`)
      alert('Notificação enviada!')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg || 'Erro ao notificar')
    }
  }

  const handleCheckIn = async (ag: Agendamento) => {
    if (!window.confirm(`Confirmar check-in de ${ag.paciente_nome}?`)) return
    try {
      const res = await api.post(`/agendamentos/${ag.id}/checkin`)
      alert(`Check-in realizado! ${res.data.senha ? 'Senha: ' + res.data.senha : ''}`)
      fetchAgendamentos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg || 'Erro ao fazer check-in')
    }
  }

  const handleDelete = async (id: number, nome: string) => {
    if (!window.confirm(`Remover agendamento de ${nome}?`)) return
    try {
      await api.delete(`/agendamentos/${id}`)
      fetchAgendamentos()
    } catch { alert('Erro ao remover agendamento') }
  }

  // Calendar click: calculate time from click position
  const handleCalendarClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.cal-appointment')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top + e.currentTarget.scrollTop
    const minutesFromStart = Math.floor(y / (PX_PER_HOUR / 60) / 30) * 30
    const totalMins = HOUR_START * 60 + minutesFromStart
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    if (h >= HOUR_START && h < HOUR_END) {
      openCreate(toDateStr(day), `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  // ── Week navigation ───────────────────────────────────────────────────────────
  const prevWeek = () => setWeekDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setWeekDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
  const goToday  = () => setWeekDate(getMonday(new Date()))
  const weekDays = getWeekDays(weekDate)

  // ── Week month label ──────────────────────────────────────────────────────────
  const weekMonthLabel = (() => {
    const m0 = weekDays[0].toLocaleDateString('pt-BR', { month: 'long' })
    const m6 = weekDays[6].toLocaleDateString('pt-BR', { month: 'long' })
    const y  = weekDays[0].getFullYear()
    return m0 === m6 ? `${m0} ${y}` : `${m0} / ${m6} ${y}`
  })()

  // ── Hours list ────────────────────────────────────────────────────────────────
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="agenda-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn-voltar" onClick={() => navigate('/menu')}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <h1 className="page-title">Agendamentos</h1>
        </div>
        <div className="page-header-right">
          <div className="view-toggle">
            <button className={`view-btn${view === 'lista' ? ' view-btn--active' : ''}`} onClick={() => setView('lista')}>
              <List size={15} /> Lista
            </button>
            <button className={`view-btn${view === 'semana' ? ' view-btn--active' : ''}`} onClick={() => setView('semana')}>
              <CalendarDays size={15} /> Semana
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => openCreate()}>
            <Plus size={15} /> Novo
          </button>
        </div>
      </div>

      {/* ── LISTA VIEW ── */}
      {view === 'lista' && (
        <>
          {/* Filters */}
          <div className="agenda-filters">
            <div className="filter-group">
              <label>De</label>
              <DatePicker value={fDataI} onChange={setFDataI} />
            </div>
            <div className="filter-group">
              <label>Até</label>
              <DatePicker value={fDataF} onChange={setFDataF} />
            </div>
            <div className="filter-group">
              <label>Especialidade</label>
              <select value={fEsp} onChange={e => setFEsp(e.target.value)}>
                <option value="">Todas</option>
                {especialidades.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Médico</label>
              <select value={fMedico} onChange={e => setFMedico(e.target.value)}>
                <option value="">Todos</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="agenda-loading">Carregando...</div>
          ) : agendamentos.length === 0 ? (
            <div className="agenda-empty">
              <CalendarDays size={48} />
              <p>Nenhum agendamento encontrado</p>
              <button className="btn btn-primary" onClick={() => openCreate()}>Criar agendamento</button>
            </div>
          ) : (
            <div className="agenda-list">
              {agendamentos.map(ag => (
                <div key={ag.id} className={`agenda-card${ag.status === 'cancelado' ? ' agenda-card--cancelled' : ''}`}>
                  <div className="agenda-card-esp" style={{ background: ag.especialidade_cor }} />
                  <div className="agenda-card-body">
                    <div className="agenda-card-top">
                      <span className="agenda-card-paciente">{ag.paciente_nome}</span>
                      <span className={`agenda-badge ${STATUS_CLASS[ag.status]}`}>{STATUS_LABELS[ag.status]}</span>
                    </div>
                    <div className="agenda-card-meta">
                      <span className="meta-item">
                        <CalendarDays size={13} /> {fmtDateTime(ag.data_hora)}
                        <span className="meta-dur">{ag.duracao_min} min</span>
                      </span>
                      <span className="meta-item esp-chip" style={{ background: ag.especialidade_cor + '22', color: ag.especialidade_cor }}>
                        {ag.especialidade_nome}
                      </span>
                      {ag.medico_nome && <span className="meta-item">Dr(a). {ag.medico_nome}</span>}
                      <span className="meta-item tipo-chip">{TIPO_LABELS[ag.tipo]}</span>
                    </div>
                    {ag.observacoes && <p className="agenda-card-obs">{ag.observacoes}</p>}
                  </div>
                  <div className="agenda-card-actions">
                    {ag.status === 'agendado' && (
                      <button className="action-btn action-btn--confirm" title="Confirmar" onClick={() => handleConfirmar(ag.id)}>
                        <CheckCircle size={15} />
                      </button>
                    )}
                    {(ag.status === 'confirmado' || ag.status === 'agendado') && !ag.fila_id && (
                      <button className="action-btn action-btn--checkin" title="Check-in" onClick={() => handleCheckIn(ag)}>
                        <LogIn size={15} />
                      </button>
                    )}
                    {ag.paciente_telefone && ag.status !== 'cancelado' && (
                      <button className="action-btn action-btn--notify" title="Notificar WhatsApp" onClick={() => handleNotificar(ag.id)}>
                        <Bell size={15} />
                      </button>
                    )}
                    {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                      <button className="action-btn action-btn--edit" title="Editar" onClick={() => openEdit(ag)}>
                        <Pencil size={15} />
                      </button>
                    )}
                    <button className="action-btn action-btn--delete" title="Remover" onClick={() => handleDelete(ag.id, ag.paciente_nome)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SEMANA VIEW ── */}
      {view === 'semana' && (
        <>
          {/* Week nav */}
          <div className="cal-nav">
            <div className="cal-nav-group">
              <button className="cal-nav-btn" onClick={prevWeek}><ChevronLeft size={16} /></button>
              <button className="cal-nav-btn cal-nav-today" onClick={goToday}>Hoje</button>
              <button className="cal-nav-btn" onClick={nextWeek}><ChevronRight size={16} /></button>
            </div>
            <div className="cal-nav-info">
              <span className="cal-nav-month">{weekMonthLabel}</span>
              <span className="cal-nav-range">{fmtDate(weekDays[0])} — {fmtDate(weekDays[6])}</span>
            </div>
          </div>

          {/* Calendar */}
          <div className="cal-outer">
            {/* Day headers */}
            <div className="cal-header">
              <div className="cal-time-gutter" />
              {weekDays.map((day, i) => {
                const isToday   = isSameDay(day, new Date())
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                const cls = ['cal-day-header', isToday && 'cal-day-header--today', isWeekend && 'cal-day-header--weekend'].filter(Boolean).join(' ')
                return (
                  <div key={i} className={cls}>
                    <span className="cal-day-name">{fmtDayName(day)}</span>
                    <span className={`cal-day-num${isToday ? ' cal-day-num--today' : ''}`}>{day.getDate()}</span>
                  </div>
                )
              })}
            </div>

            {/* Grid */}
            <div className="cal-grid-scroll">
              <div className="cal-grid">
                {/* Time gutter */}
                <div className="cal-time-gutter">
                  {hours.map(h => (
                    <div key={h} className="cal-hour-label" style={{ height: PX_PER_HOUR }}>
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, di) => {
                  const dayAppts  = agendamentos.filter(a => isSameDay(new Date(a.data_hora.replace(' ', 'T')), day))
                  const isToday   = isSameDay(day, new Date())
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  const colCls    = ['cal-day-col', isToday && 'cal-day-col--today', isWeekend && 'cal-day-col--weekend'].filter(Boolean).join(' ')

                  // Current time indicator
                  const nowLine = (() => {
                    if (!isToday) return null
                    const now = new Date()
                    const top = ((now.getHours() - HOUR_START) * 60 + now.getMinutes()) / 60 * PX_PER_HOUR
                    return top >= 0 && top <= (HOUR_END - HOUR_START) * PX_PER_HOUR
                      ? <div className="cal-now-line" style={{ top }} />
                      : null
                  })()

                  return (
                    <div
                      key={di}
                      className={colCls}
                      style={{ height: (HOUR_END - HOUR_START) * PX_PER_HOUR }}
                      onClick={e => handleCalendarClick(day, e)}
                    >
                      {/* Hour lines + half-hour lines */}
                      {hours.map(h => (
                        <React.Fragment key={h}>
                          <div className="cal-hour-line" style={{ top: (h - HOUR_START) * PX_PER_HOUR }} />
                          <div className="cal-half-line" style={{ top: (h - HOUR_START) * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
                        </React.Fragment>
                      ))}
                      {nowLine}
                      {/* Appointments */}
                      {dayAppts.map(ag => {
                        const compact = ag.duracao_min < 30
                        return (
                          <div
                            key={ag.id}
                            className={`cal-appointment status-${ag.status}${compact ? ' cal-appt-compact' : ''}`}
                            style={{
                              top:    apptTopPx(ag.data_hora),
                              height: Math.max(apptHeightPx(ag.duracao_min), 22),
                              '--esp-c': ag.especialidade_cor,
                            } as React.CSSProperties}
                            onClick={e => { e.stopPropagation(); openEdit(ag) }}
                          >
                            {compact ? (
                              <div className="cal-appt-row">
                                <span className="cal-appt-time">{fmtTime(ag.data_hora)}</span>
                                <span className="cal-appt-name">{ag.paciente_nome.split(' ')[0]}</span>
                              </div>
                            ) : (
                              <>
                                <div className="cal-appt-row">
                                  <span className="cal-appt-time">{fmtTime(ag.data_hora)}</span>
                                  <span className="cal-appt-esp-dot" style={{ background: ag.especialidade_cor }} />
                                </div>
                                <span className="cal-appt-name">
                                  {ag.paciente_nome.split(' ')[0]}{' '}
                                  {ag.paciente_nome.split(' ').slice(-1)[0]}
                                </span>
                                {ag.medico_nome && (
                                  <span className="cal-appt-doc">{ag.medico_nome.split(' ').slice(-1)[0]}</span>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box modal-box--lg">
            <div className="modal-header">
              <div className="modal-header-info">
                <h2>{editingId ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
                <p className="modal-header-sub">{editingId ? 'Atualize os dados do agendamento' : 'Preencha os dados para criar um agendamento'}</p>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="modal-body" ref={modalBodyRef}>
              {error && <div className="modal-error">{error}</div>}

              {/* ─ Seção: Paciente ─ */}
              <div className="modal-section">
                <div className="modal-section-hd"><User size={13} /> Paciente</div>
                <div className="pac-search-wrap">
                  <div className="pac-search-input-wrap">
                    <Search size={15} className="pac-search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou CPF..."
                      value={pacSearch}
                      onChange={e => { setPacSearch(e.target.value); if (!e.target.value) { setSelectedPac(null); setForm(f => ({ ...f, paciente_id: null })) } }}
                      className="pac-search-input"
                    />
                    {pacLoading && <span className="pac-loading">...</span>}
                    {selectedPac && (
                      <button className="pac-clear" onClick={() => { setSelectedPac(null); setPacSearch(''); setForm(f => ({ ...f, paciente_id: null })) }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {selectedPac && (
                    <div className="pac-selected-card">
                      <div className="pac-selected-avatar">{selectedPac.nome_completo[0]}</div>
                      <div>
                        <div className="pac-selected-name">{selectedPac.nome_completo}</div>
                        {selectedPac.cpf && <div className="pac-selected-cpf">CPF: {selectedPac.cpf}</div>}
                        {selectedPac.telefone && <div className="pac-selected-cpf">{selectedPac.telefone}</div>}
                      </div>
                      <span className="pac-selected-check">&#10003;</span>
                    </div>
                  )}
                  {pacResults.length > 0 && !selectedPac && (
                    <ul className="pac-dropdown">
                      {pacResults.map(p => (
                        <li key={p.id} onClick={() => {
                          setSelectedPac(p)
                          setPacSearch(p.nome_completo)
                          setPacResults([])
                          setForm(f => ({ ...f, paciente_id: p.id }))
                        }}>
                          <div className="pac-drop-avatar">{p.nome_completo[0]}</div>
                          <div>
                            <span className="pac-nome">{p.nome_completo}</span>
                            {p.cpf && <span className="pac-cpf">{p.cpf}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* ─ Seção: Especialidade & Médico ─ */}
              {(() => {
                const selEsp = especialidades.find(e => String(e.id) === form.especialidade_id)
                return (
                  <div className="modal-section">
                    <div className="modal-section-hd"><Stethoscope size={13} /> Especialidade &amp; Médico</div>
                    <div className="esp-pills">
                      {especialidades.map(e => (
                        <button
                          key={e.id}
                          type="button"
                          className={`esp-pill${form.especialidade_id === String(e.id) ? ' active' : ''}`}
                          style={form.especialidade_id === String(e.id) ? { '--esp-c': e.cor } as React.CSSProperties : {}}
                          onClick={() => setForm(f => ({ ...f, especialidade_id: String(e.id), medico_id: '' }))}
                        >
                          <span className="esp-pill-dot" style={{ background: e.cor }} />
                          {e.nome}
                        </button>
                      ))}
                    </div>
                    <div className="form-group" style={{ marginTop: 8 }}>
                      <label>Médico <span className="lbl-opt">(opcional)</span></label>
                      <select
                        value={form.medico_id}
                        onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}
                        style={selEsp ? { borderColor: selEsp.cor + '66' } : {}}
                      >
                        <option value="">Sem médico definido</option>
                        {medicosFiltrados.map(m => <option key={m.id} value={m.id}>Dr(a). {m.nome}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })()}

              {/* ─ Seção: Quando ─ */}
              <div className="modal-section">
                <div className="modal-section-hd"><CalendarDays size={13} /> Quando</div>
                <div className="form-row-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label>Data *</label>
                    <DatePicker value={form.data} onChange={v => setForm(f => ({ ...f, data: v }))} />
                  </div>
                  <div className="form-group">
                    <label>Hora *</label>
                    <TimeWheelPicker value={form.hora} onChange={v => setForm(f => ({ ...f, hora: v }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Duração</label>
                  <div className="dur-pills">
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`dur-pill${form.duracao_min === d ? ' active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, duracao_min: d }))}
                      >
                        {d < 60 ? `${d}min` : `${d / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─ Seção: Tipo ─ */}
              <div className="modal-section">
                <div className="modal-section-hd"><Tag size={13} /> Tipo de consulta</div>
                <div className="tipo-pills">
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      className={`tipo-pill tipo-pill--${k}${form.tipo === k ? ' active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, tipo: k }))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─ Seção: Status ─ */}
              <div className="modal-section modal-section--last">
                <div className="modal-section-hd"><Activity size={13} /> Status inicial</div>
                <div className="st-pills">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      className={`st-pill st-pill--${k}${form.status === k ? ' active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, status: k }))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─ Observações ─ */}
              <div className="form-group">
                <label>Observações <span className="lbl-opt">(opcional)</span></label>
                <textarea rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informações adicionais..." />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : (editingId ? 'Salvar alterações' : 'Criar agendamento')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

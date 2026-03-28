import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, CalendarDays, School, Plus, Trash2, ChevronLeft, ChevronRight, Users, CalendarCheck, CalendarX } from 'lucide-react'
import './AgendaEscola.css'

interface EscolaOption {
  escola: string
  total: number
}

interface AgendaItem {
  id: number
  escola: string
  data_atendimento: string
  total_alunos: number
}

export default function AgendaEscola() {
  const [escolas, setEscolas] = useState<EscolaOption[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [selectedEscola, setSelectedEscola] = useState('')
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [mesAtual, setMesAtual] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadEscolas()
  }, [])

  useEffect(() => {
    loadAgenda()
  }, [mesAtual])

  async function loadEscolas() {
    try {
      const { data } = await api.get('/pacientes/escolas/contagem')
      setEscolas(data)
    } catch { /* */ }
  }

  async function loadAgenda() {
    try {
      const { data } = await api.get(`/escola-agenda?mes=${mesAtual}`)
      setAgenda(data)
    } catch { /* */ }
  }

  async function salvarDatas() {
    if (!selectedEscola || selectedDates.length === 0) return
    setSaving(true)
    try {
      await api.post('/escola-agenda', { escola: selectedEscola, datas: selectedDates })
      setSelectedDates([])
      loadAgenda()
    } catch { /* */ } finally {
      setSaving(false)
    }
  }

  async function removerAgenda(item: AgendaItem) {
    try {
      await api.delete(`/escola-agenda/${item.id}`)
      loadAgenda()
    } catch { /* */ }
  }

  function toggleDate(dateStr: string) {
    setSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    )
  }

  // Calendar helpers
  const [ano, mes] = mesAtual.split('-').map(Number)
  const primeiroDia = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0)
  const diasNoMes = ultimoDia.getDate()
  const inicioSemana = primeiroDia.getDay() // 0=Sun

  const mesLabel = primeiroDia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function navigateMes(dir: number) {
    const d = new Date(ano, mes - 1 + dir, 1)
    setMesAtual(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // Group agenda by date
  const agendaByDate = new Map<string, AgendaItem[]>()
  for (const item of agenda) {
    const key = item.data_atendimento
    if (!agendaByDate.has(key)) agendaByDate.set(key, [])
    agendaByDate.get(key)!.push(item)
  }

  const _now = new Date()
  const hoje = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

  const stats = useMemo(() => {
    const escolasAgendadas = new Set(agenda.map(a => a.escola)).size
    const datasAgendadas = new Set(agenda.map(a => a.data_atendimento)).size
    const escolasVistas = new Set<string>()
    let totalAlunos = 0
    for (const a of agenda) {
      if (!escolasVistas.has(a.escola)) {
        escolasVistas.add(a.escola)
        totalAlunos += a.total_alunos
      }
    }
    return { escolasAgendadas, datasAgendadas, totalAlunos }
  }, [agenda])

  return (
    <div className="agenda-escola-page">
      {/* Hero Header */}
      <div className="ae-hero">
        <div className="ae-hero-top">
          <Link to="/admin" className="btn btn-secondary btn-sm ae-btn-back">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="ae-hero-content">
          <div className="ae-hero-icon">
            <CalendarDays size={28} />
          </div>
          <div>
            <h1>Agenda de Escolas</h1>
            <p className="ae-hero-subtitle">Defina os dias de atendimento para cada escola</p>
          </div>
        </div>
        <div className="ae-stats-row">
          <div className="ae-stat">
            <span className="ae-stat-value">{stats.escolasAgendadas}</span>
            <span className="ae-stat-label">Escolas</span>
          </div>
          <div className="ae-stat">
            <span className="ae-stat-value ae-stat-datas">{stats.datasAgendadas}</span>
            <span className="ae-stat-label">Datas</span>
          </div>
          <div className="ae-stat">
            <span className="ae-stat-value ae-stat-alunos">{stats.totalAlunos}</span>
            <span className="ae-stat-label">Alunos</span>
          </div>
        </div>
      </div>

      <div className="ae-content-grid">

      {/* Add schedule */}
      <div className="agenda-add-section">
        <div className="ae-section-header">
          <div className="ae-section-icon ae-section-icon-add">
            <Plus size={16} />
          </div>
          <h3>Agendar Escola</h3>
        </div>

        <div className="agenda-form-row">
          <div className="agenda-form-group">
            <label>Escola</label>
            <div className="ae-select-wrapper">
              <School size={16} className="ae-select-icon" />
              <select
                value={selectedEscola}
                onChange={e => { setSelectedEscola(e.target.value); setSelectedDates([]) }}
              >
                <option value="">— Selecione a escola —</option>
                {escolas.map(e => (
                  <option key={e.escola} value={e.escola}>
                    {e.escola} ({e.total} alunos)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedEscola && (
          <>
            <p className="agenda-hint">Clique nos dias do calendário para selecionar as datas de atendimento:</p>

            {/* Mini calendar */}
            <div className="agenda-calendar">
              <div className="cal-header">
                <button onClick={() => navigateMes(-1)} className="cal-nav"><ChevronLeft size={18} /></button>
                <span className="cal-month">{mesLabel}</span>
                <button onClick={() => navigateMes(1)} className="cal-nav"><ChevronRight size={18} /></button>
              </div>
              <div className="cal-weekdays">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="cal-days">
                {Array.from({ length: inicioSemana }).map((_, i) => (
                  <span key={`empty-${i}`} className="cal-day cal-day-empty" />
                ))}
                {Array.from({ length: diasNoMes }).map((_, i) => {
                  const dia = i + 1
                  const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                  const isSelected = selectedDates.includes(dateStr)
                  const isScheduled = agendaByDate.has(dateStr) &&
                    agendaByDate.get(dateStr)!.some(a => a.escola === selectedEscola)
                  const isToday = dateStr === hoje
                  const isPast = dateStr < hoje

                  return (
                    <button
                      key={dia}
                      className={`cal-day ${isSelected ? 'cal-day-selected' : ''} ${isScheduled ? 'cal-day-scheduled' : ''} ${isToday ? 'cal-day-today' : ''} ${isPast ? 'cal-day-past' : ''}`}
                      onClick={() => !isScheduled && toggleDate(dateStr)}
                      disabled={isScheduled}
                      title={isScheduled ? 'Já agendado' : dateStr}
                    >
                      {dia}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDates.length > 0 && (
              <div className="agenda-selected-dates">
                <div className="ae-selected-info">
                  <CalendarCheck size={16} />
                  <span><strong>{selectedDates.length}</strong> data(s) selecionada(s)</span>
                </div>
                <button
                  className="btn btn-primary ae-btn-salvar"
                  onClick={salvarDatas}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar Agenda'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Current schedule */}
      <div className="agenda-list-section">
        <div className="ae-section-header">
          <div className="ae-section-icon">
            <CalendarDays size={16} />
          </div>
          <div>
            <h3>Agenda de {mesLabel}</h3>
            <p className="ae-section-sub">{agenda.length} agendamento(s)</p>
          </div>
        </div>

        {agenda.length === 0 ? (
          <div className="agenda-empty">
            <CalendarX size={36} strokeWidth={1.5} />
            <p>Nenhuma escola agendada para este mês</p>
          </div>
        ) : (
          <div className="agenda-table-wrapper">
            <table className="agenda-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Escola</th>
                  <th>Alunos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agenda.map(item => {
                  const d = new Date(item.data_atendimento + 'T00:00:00')
                  const isHoje = item.data_atendimento === hoje
                  return (
                    <tr key={item.id} className={isHoje ? 'agenda-row-hoje' : ''}>
                      <td>
                        <span className="agenda-date">
                          {d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </span>
                        {isHoje && <span className="badge-hoje">HOJE</span>}
                      </td>
                      <td>
                        <div className="ae-cell-escola">
                          <School size={14} />
                          <span>{item.escola}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ae-cell-alunos">
                          <Users size={14} />
                          <span>{item.total_alunos}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn-remove-agenda"
                          onClick={() => removerAgenda(item)}
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

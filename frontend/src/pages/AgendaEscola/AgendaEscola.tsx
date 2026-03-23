import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, CalendarDays, School, Plus, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react'
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

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="agenda-escola-page">
      <div className="page-header">
        <div>
          <h1><CalendarDays size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Agenda de Escolas</h1>
          <p>Defina os dias de atendimento para cada escola</p>
        </div>
        <Link to="/admin" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
      </div>

      {/* Add schedule */}
      <div className="agenda-add-section">
        <h3><Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Agendar Escola</h3>

        <div className="agenda-form-row">
          <div className="agenda-form-group">
            <label>Escola</label>
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
                <span>{selectedDates.length} data(s) selecionada(s)</span>
                <button
                  className="btn btn-primary"
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
        <h3>
          <CalendarDays size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Agenda de {mesLabel}
        </h3>

        {agenda.length === 0 ? (
          <p className="agenda-empty">Nenhuma escola agendada para este mês</p>
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
                        <School size={14} style={{ verticalAlign: 'middle', marginRight: 4, opacity: 0.6 }} />
                        {item.escola}
                      </td>
                      <td>
                        <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4, opacity: 0.6 }} />
                        {item.total_alunos}
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
  )
}

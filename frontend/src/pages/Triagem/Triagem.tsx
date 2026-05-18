import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Activity, Heart, Thermometer, Droplets,
  Plus, Search, X, Clock, Wind, Scale, Ruler,
  Edit2, Trash2, Stethoscope, ChevronLeft, ChevronRight,
  AlertCircle, Gauge, FlaskConical, Zap,
} from 'lucide-react'
import api from '../../services/api.ts'
import DatePicker from '../../components/DatePicker/DatePicker.tsx'
import './Triagem.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Prioridade = 'azul' | 'verde' | 'amarelo' | 'laranja' | 'vermelho'

interface TriagemRecord {
  id: number
  paciente_id: number
  nome_completo: string
  paciente_codigo: string | null
  data_nascimento: string | null
  idade?: number
  usuario_nome: string
  especialidade_nome: string | null
  especialidade_cor: string | null
  pa_sistolica: number | null
  pa_diastolica: number | null
  frequencia_cardiaca: number | null
  frequencia_respiratoria: number | null
  saturacao_o2: number | null
  temperatura: number | null
  peso: number | null
  altura: number | null
  imc: number | null
  glicemia: number | null
  queixa_principal: string | null
  dor_escala: number | null
  prioridade: Prioridade
  observacoes: string | null
  created_at: string
}

interface Paciente {
  id: number
  nome_completo: string
  codigo: string | null
  data_nascimento: string | null
}

interface Especialidade {
  id: number
  nome: string
  cor: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORIDADES: { value: Prioridade; label: string; cor: string; tempo: string }[] = [
  { value: 'vermelho', label: 'Vermelho', cor: '#e53e3e', tempo: 'Imediato'   },
  { value: 'laranja',  label: 'Laranja',  cor: '#dd6b20', tempo: '10 min'     },
  { value: 'amarelo',  label: 'Amarelo',  cor: '#d69e2e', tempo: '60 min'     },
  { value: 'verde',    label: 'Verde',    cor: '#38a169', tempo: '120 min'    },
  { value: 'azul',     label: 'Azul',     cor: '#3182ce', tempo: '240 min'    },
]

const PRIO_LABEL: Record<Prioridade, string> = {
  vermelho: 'Emergência',
  laranja:  'Muito urgente',
  amarelo:  'Urgente',
  verde:    'Pouco urgente',
  azul:     'Não urgente',
}

// ─── Vital-sign status helpers ────────────────────────────────────────────────

function paStatus(s?: number | null, d?: number | null): 'normal' | 'warning' | 'danger' {
  if (!s || !d) return 'normal'
  if (s >= 180 || d >= 110) return 'danger'
  if (s >= 130 || d >= 80 || s < 90 || d < 60) return 'warning'
  return 'normal'
}
function fcStatus(v?: number | null): 'normal' | 'warning' | 'danger' {
  if (!v) return 'normal'
  if (v < 40 || v > 150) return 'danger'
  if (v < 60 || v > 100) return 'warning'
  return 'normal'
}
function spo2Status(v?: number | null): 'normal' | 'warning' | 'danger' {
  if (!v) return 'normal'
  if (v < 90) return 'danger'
  if (v < 95) return 'warning'
  return 'normal'
}
function tempStatus(v?: number | null): 'normal' | 'warning' | 'danger' {
  if (!v) return 'normal'
  if (v >= 39 || v < 35) return 'danger'
  if (v >= 37.8) return 'warning'
  return 'normal'
}
function imcStatus(v?: number | null): 'normal' | 'warning' | 'danger' {
  if (!v) return 'normal'
  if (v < 16 || v >= 40) return 'danger'
  if (v < 18.5 || v >= 30) return 'warning'
  return 'normal'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function calcIdade(dob?: string | null): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const EMPTY_FORM = {
  paciente_id: 0,
  especialidade_id: '',
  pa_sistolica: '',
  pa_diastolica: '',
  frequencia_cardiaca: '',
  frequencia_respiratoria: '',
  saturacao_o2: '',
  temperatura: '',
  peso: '',
  altura: '',
  glicemia: '',
  queixa_principal: '',
  dor_escala: null as number | null,
  prioridade: 'verde' as Prioridade,
  observacoes: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Triagem() {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const [registros, setRegistros]           = useState<TriagemRecord[]>([])
  const [loading, setLoading]               = useState(true)
  const [data, setData]                     = useState<string>(todayStr)
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId]       = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })

  // Patient search
  const [pacSearch, setPacSearch]     = useState('')
  const [pacResults, setPacResults]   = useState<Paciente[]>([])
  const [selectedPac, setSelectedPac] = useState<Paciente | null>(null)
  const [showPacDrop, setShowPacDrop] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // List filter
  const [busca, setBusca] = useState('')

  // Computed IMC
  const imcCalc = useMemo<string | null>(() => {
    if (!form.peso || !form.altura) return null
    const m = parseFloat(form.altura) / 100
    if (m <= 0) return null
    return (parseFloat(form.peso) / (m * m)).toFixed(1)
  }, [form.peso, form.altura])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/triagem?data=${data}`)
      setRegistros(r.data.data || [])
    } catch { setRegistros([]) }
    setLoading(false)
  }, [data])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/especialidades').then(r => setEspecialidades(Array.isArray(r.data) ? r.data : (r.data.data || []))).catch(() => {})
  }, [])

  // Patient search debounce
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (pacSearch.length < 2) { setPacResults([]); setShowPacDrop(false); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.get(`/pacientes?search=${encodeURIComponent(pacSearch)}&limit=8`)
        setPacResults(r.data.data || [])
        setShowPacDrop(true)
      } catch { setPacResults([]) }
    }, 300)
  }, [pacSearch])

  function setF<K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function openNew() {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
    setSelectedPac(null)
    setPacSearch('')
    setPacResults([])
    setShowPacDrop(false)
    setModalOpen(true)
  }

  function openEdit(r: TriagemRecord) {
    setEditId(r.id)
    setSelectedPac({ id: r.paciente_id, nome_completo: r.nome_completo, codigo: r.paciente_codigo, data_nascimento: r.data_nascimento })
    setPacSearch(r.nome_completo)
    setShowPacDrop(false)
    setForm({
      paciente_id: r.paciente_id,
      especialidade_id: especialidades.find(e => e.nome === r.especialidade_nome)?.id?.toString() ?? '',
      pa_sistolica: r.pa_sistolica?.toString() ?? '',
      pa_diastolica: r.pa_diastolica?.toString() ?? '',
      frequencia_cardiaca: r.frequencia_cardiaca?.toString() ?? '',
      frequencia_respiratoria: r.frequencia_respiratoria?.toString() ?? '',
      saturacao_o2: r.saturacao_o2?.toString() ?? '',
      temperatura: r.temperatura?.toString() ?? '',
      peso: r.peso?.toString() ?? '',
      altura: r.altura?.toString() ?? '',
      glicemia: r.glicemia?.toString() ?? '',
      queixa_principal: r.queixa_principal ?? '',
      dor_escala: r.dor_escala ?? null,
      prioridade: r.prioridade,
      observacoes: r.observacoes ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!selectedPac) return
    setSaving(true)
    const body = {
      paciente_id:             selectedPac.id,
      especialidade_id:        form.especialidade_id || null,
      pa_sistolica:            form.pa_sistolica || null,
      pa_diastolica:           form.pa_diastolica || null,
      frequencia_cardiaca:     form.frequencia_cardiaca || null,
      frequencia_respiratoria: form.frequencia_respiratoria || null,
      saturacao_o2:            form.saturacao_o2 || null,
      temperatura:             form.temperatura || null,
      peso:                    form.peso || null,
      altura:                  form.altura || null,
      glicemia:                form.glicemia || null,
      queixa_principal:        form.queixa_principal || null,
      dor_escala:              form.dor_escala,
      prioridade:              form.prioridade,
      observacoes:             form.observacoes || null,
    }
    try {
      if (editId) {
        await api.put(`/triagem/${editId}`, body)
      } else {
        await api.post('/triagem', body)
      }
      setModalOpen(false)
      load()
    } catch { /* silently handled */ }
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm('Remover este registro de triagem?')) return
    await api.delete(`/triagem/${id}`)
    setRegistros(r => r.filter(x => x.id !== id))
  }

  const filtered = busca
    ? registros.filter(r => r.nome_completo.toLowerCase().includes(busca.toLowerCase()))
    : registros

  const stats = {
    total:    registros.length,
    vermelho: registros.filter(r => r.prioridade === 'vermelho').length,
    laranja:  registros.filter(r => r.prioridade === 'laranja').length,
    amarelo:  registros.filter(r => r.prioridade === 'amarelo').length,
    verde:    registros.filter(r => r.prioridade === 'verde').length,
    azul:     registros.filter(r => r.prioridade === 'azul').length,
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="triagem-page">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="triagem-header">
        <div className="triagem-title">
          <div className="triagem-title-icon"><Activity size={22} /></div>
          <div>
            <h1>Triagem</h1>
            <p>Registro de sinais vitais e protocolo Manchester</p>
          </div>
        </div>
        <div className="triagem-header-actions">
          <div className="triagem-search-bar">
            <Search size={15} />
            <input
              placeholder="Buscar paciente..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <DatePicker value={data} onChange={d => d && setData(d as string)} />
          <button className="triagem-btn-new" onClick={openNew}>
            <Plus size={16} /> Nova Triagem
          </button>
        </div>
      </div>

      {/* ─── Stats ──────────────────────────────────────────────────────────── */}
      <div className="triagem-stats">
        <div className="triagem-stat triagem-stat--total">
          <span className="ts-value">{stats.total}</span>
          <span className="ts-label">Total</span>
        </div>
        {PRIORIDADES.map(p => (
          <div key={p.value} className="triagem-stat" style={{ '--prio-c': p.cor } as React.CSSProperties}>
            <span className="ts-value">{stats[p.value]}</span>
            <span className="ts-label">{p.label}</span>
          </div>
        ))}
      </div>

      {/* ─── List ───────────────────────────────────────────────────────────── */}
      <div className="triagem-list">
        {loading ? (
          <div className="triagem-empty">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="triagem-empty">
            <Activity size={36} />
            <p>Nenhuma triagem registrada{busca ? ' para esta busca' : ' hoje'}</p>
          </div>
        ) : (
          filtered.map(r => {
            const idade = r.idade ?? calcIdade(r.data_nascimento)
            const prio  = PRIORIDADES.find(p => p.value === r.prioridade)!

            return (
              <div key={r.id} className={`triagem-row triagem-row--${r.prioridade}`}>
                {/* Priority bar */}
                <div className="trow-prio-bar" style={{ background: prio.cor }} />

                {/* Patient */}
                <div className="trow-patient">
                  <div className="trow-avatar" style={{ background: prio.cor + '33', color: prio.cor }}>
                    {initials(r.nome_completo)}
                  </div>
                  <div className="trow-patient-info">
                    <span className="trow-name">{r.nome_completo}</span>
                    <span className="trow-meta">
                      {idade != null ? `${idade} anos` : ''}
                      {r.especialidade_nome && (
                        <span className="trow-esp" style={{ background: (r.especialidade_cor ?? '#888') + '22', color: r.especialidade_cor ?? '#888' }}>
                          {r.especialidade_nome}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Priority badge */}
                <div className="trow-prio-badge" style={{ background: prio.cor + '22', color: prio.cor }}>
                  <span className="trow-prio-dot" style={{ background: prio.cor }} />
                  {PRIO_LABEL[r.prioridade]}
                </div>

                {/* Vitals */}
                <div className="trow-vitals">
                  {(r.pa_sistolica || r.pa_diastolica) && (
                    <div className={`trow-vital trow-vital--${paStatus(r.pa_sistolica, r.pa_diastolica)}`}>
                      <Gauge size={12} />
                      <span>{r.pa_sistolica}/{r.pa_diastolica}</span>
                      <span className="trow-vital-unit">mmHg</span>
                    </div>
                  )}
                  {r.frequencia_cardiaca && (
                    <div className={`trow-vital trow-vital--${fcStatus(r.frequencia_cardiaca)}`}>
                      <Heart size={12} />
                      <span>{r.frequencia_cardiaca}</span>
                      <span className="trow-vital-unit">bpm</span>
                    </div>
                  )}
                  {r.saturacao_o2 && (
                    <div className={`trow-vital trow-vital--${spo2Status(r.saturacao_o2)}`}>
                      <Droplets size={12} />
                      <span>{r.saturacao_o2}%</span>
                    </div>
                  )}
                  {r.temperatura && (
                    <div className={`trow-vital trow-vital--${tempStatus(r.temperatura)}`}>
                      <Thermometer size={12} />
                      <span>{r.temperatura}°C</span>
                    </div>
                  )}
                  {r.imc && (
                    <div className={`trow-vital trow-vital--${imcStatus(r.imc)}`}>
                      <Scale size={12} />
                      <span>IMC {r.imc}</span>
                    </div>
                  )}
                </div>

                {/* Queixa + Hora */}
                <div className="trow-queixa">
                  {r.queixa_principal && <p className="trow-queixa-text">{r.queixa_principal}</p>}
                  {r.dor_escala != null && (
                    <span className="trow-dor">Dor: <strong>{r.dor_escala}/10</strong></span>
                  )}
                </div>

                <div className="trow-time">
                  <Clock size={12} />
                  {fmtTime(r.created_at)}
                </div>

                {/* Actions */}
                <div className="trow-actions">
                  <button className="trow-btn" title="Editar" onClick={() => openEdit(r)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="trow-btn trow-btn--danger" title="Remover" onClick={() => del(r.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ─── Modal ──────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="triagem-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="triagem-modal">

            {/* Modal header */}
            <div className="tmodal-header">
              <div className="tmodal-header-left">
                <div className="tmodal-icon"><Activity size={18} /></div>
                <div>
                  <h2>{editId ? 'Editar Triagem' : 'Nova Triagem'}</h2>
                  <p>Protocolo Manchester de classificação de risco</p>
                </div>
              </div>
              <button className="tmodal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>

            <div className="tmodal-body">

              {/* ── Paciente ──────────────────────────────────────────────── */}
              <div className="tmodal-section">
                <div className="tmodal-section-title">
                  <div className="tmodal-section-icon" style={{ background: 'rgba(115,69,214,0.15)', color: 'var(--primary)' }}>
                    <Stethoscope size={14} />
                  </div>
                  Paciente
                </div>
                <div className="tmodal-pac-wrap" style={{ position: 'relative' }}>
                  {!selectedPac ? (
                    <>
                      <div className="tmodal-pac-input-row">
                        <Search size={15} className="tmodal-pac-icon" />
                        <input
                          className="tmodal-pac-input"
                          placeholder="Buscar por nome ou CPF..."
                          value={pacSearch}
                          onChange={e => { setPacSearch(e.target.value); setSelectedPac(null) }}
                          onFocus={() => pacResults.length > 0 && setShowPacDrop(true)}
                        />
                      </div>
                      {showPacDrop && pacResults.length > 0 && (
                        <div className="tmodal-pac-drop">
                          {pacResults.map(p => {
                            const idade = calcIdade(p.data_nascimento)
                            return (
                              <button key={p.id} className="tmodal-pac-item" onClick={() => {
                                setSelectedPac(p)
                                setPacSearch(p.nome_completo)
                                setShowPacDrop(false)
                              }}>
                                <div className="tmodal-pac-avatar">{initials(p.nome_completo)}</div>
                                <div className="tmodal-pac-info">
                                  <span className="tmodal-pac-nome">{p.nome_completo}</span>
                                  <span className="tmodal-pac-sub">
                                    {p.codigo && `#${p.codigo}`}
                                    {idade != null && ` · ${idade} anos`}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="tmodal-pac-selected">
                      <div className="tmodal-pac-avatar">{initials(selectedPac.nome_completo)}</div>
                      <div style={{ flex: 1 }}>
                        <strong>{selectedPac.nome_completo}</strong>
                        {calcIdade(selectedPac.data_nascimento) != null && (
                          <span> · {calcIdade(selectedPac.data_nascimento)} anos</span>
                        )}
                      </div>
                      <button className="tmodal-pac-clear" onClick={() => { setSelectedPac(null); setPacSearch(''); setPacResults([]); setShowPacDrop(false) }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Classificação de Risco ────────────────────────────────── */}
              <div className="tmodal-section">
                <div className="tmodal-section-title">
                  <div className="tmodal-section-icon" style={{ background: 'rgba(220,38,38,0.12)', color: '#e53e3e' }}>
                    <AlertCircle size={14} />
                  </div>
                  Classificação de Risco (Manchester)
                </div>
                <div className="tmodal-prio-grid">
                  {PRIORIDADES.map(p => (
                    <button
                      key={p.value}
                      className={`tmodal-prio-btn ${form.prioridade === p.value ? 'active' : ''}`}
                      style={{ '--prio-c': p.cor } as React.CSSProperties}
                      onClick={() => setF('prioridade', p.value)}
                    >
                      <span className="tmodal-prio-dot" style={{ background: p.cor }} />
                      <span className="tmodal-prio-label">{p.label}</span>
                      <span className="tmodal-prio-tempo">{p.tempo}</span>
                    </button>
                  ))}
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Queixa principal</label>
                  <textarea
                    rows={2}
                    placeholder="Motivo da consulta / queixa principal..."
                    value={form.queixa_principal}
                    onChange={e => setF('queixa_principal', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Especialidade</label>
                  <select value={form.especialidade_id} onChange={e => setF('especialidade_id', e.target.value)}>
                    <option value="">Sem especialidade</option>
                    {especialidades.map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Sinais Vitais ─────────────────────────────────────────── */}
              <div className="tmodal-section">
                <div className="tmodal-section-title">
                  <div className="tmodal-section-icon" style={{ background: 'rgba(49,130,206,0.12)', color: '#3182ce' }}>
                    <Heart size={14} />
                  </div>
                  Sinais Vitais
                </div>
                <div className="tmodal-vitals-grid">
                  <div className="tmodal-vital-group">
                    <label>
                      <Gauge size={13} /> Pressão Arterial <span className="unit">mmHg</span>
                    </label>
                    <div className="tmodal-pa-row">
                      <input
                        type="number" min="0" max="300" placeholder="Sist."
                        value={form.pa_sistolica}
                        onChange={e => setF('pa_sistolica', e.target.value)}
                        className={`tmodal-vital-input status-${paStatus(
                          form.pa_sistolica ? +form.pa_sistolica : null,
                          form.pa_diastolica ? +form.pa_diastolica : null
                        )}`}
                      />
                      <span className="tmodal-pa-sep">/</span>
                      <input
                        type="number" min="0" max="200" placeholder="Diast."
                        value={form.pa_diastolica}
                        onChange={e => setF('pa_diastolica', e.target.value)}
                        className={`tmodal-vital-input status-${paStatus(
                          form.pa_sistolica ? +form.pa_sistolica : null,
                          form.pa_diastolica ? +form.pa_diastolica : null
                        )}`}
                      />
                    </div>
                  </div>
                  <div className="tmodal-vital-group">
                    <label>
                      <Heart size={13} /> Freq. Cardíaca <span className="unit">bpm</span>
                    </label>
                    <input
                      type="number" min="0" max="300" placeholder="60–100"
                      value={form.frequencia_cardiaca}
                      onChange={e => setF('frequencia_cardiaca', e.target.value)}
                      className={`tmodal-vital-input status-${fcStatus(form.frequencia_cardiaca ? +form.frequencia_cardiaca : null)}`}
                    />
                  </div>
                  <div className="tmodal-vital-group">
                    <label>
                      <Wind size={13} /> Freq. Respiratória <span className="unit">ipm</span>
                    </label>
                    <input
                      type="number" min="0" max="60" placeholder="12–20"
                      value={form.frequencia_respiratoria}
                      onChange={e => setF('frequencia_respiratoria', e.target.value)}
                      className="tmodal-vital-input"
                    />
                  </div>
                  <div className="tmodal-vital-group">
                    <label>
                      <Droplets size={13} /> SpO₂ <span className="unit">%</span>
                    </label>
                    <input
                      type="number" min="0" max="100" placeholder="≥ 95"
                      value={form.saturacao_o2}
                      onChange={e => setF('saturacao_o2', e.target.value)}
                      className={`tmodal-vital-input status-${spo2Status(form.saturacao_o2 ? +form.saturacao_o2 : null)}`}
                    />
                  </div>
                  <div className="tmodal-vital-group">
                    <label>
                      <Thermometer size={13} /> Temperatura <span className="unit">°C</span>
                    </label>
                    <input
                      type="number" min="30" max="45" step="0.1" placeholder="36.0–37.5"
                      value={form.temperatura}
                      onChange={e => setF('temperatura', e.target.value)}
                      className={`tmodal-vital-input status-${tempStatus(form.temperatura ? +form.temperatura : null)}`}
                    />
                  </div>
                </div>
              </div>

              {/* ── Antropometria ────────────────────────────────────────────*/}
              <div className="tmodal-section">
                <div className="tmodal-section-title">
                  <div className="tmodal-section-icon" style={{ background: 'rgba(56,161,105,0.12)', color: '#38a169' }}>
                    <Scale size={14} />
                  </div>
                  Antropometria
                </div>
                <div className="tmodal-antro-grid">
                  <div className="tmodal-vital-group">
                    <label><Scale size={13} /> Peso <span className="unit">kg</span></label>
                    <input type="number" min="0" max="300" step="0.1" placeholder="kg"
                      value={form.peso} onChange={e => setF('peso', e.target.value)} className="tmodal-vital-input" />
                  </div>
                  <div className="tmodal-vital-group">
                    <label><Ruler size={13} /> Altura <span className="unit">cm</span></label>
                    <input type="number" min="0" max="250" placeholder="cm"
                      value={form.altura} onChange={e => setF('altura', e.target.value)} className="tmodal-vital-input" />
                  </div>
                  <div className="tmodal-vital-group">
                    <label><Activity size={13} /> IMC <span className="unit">calculado</span></label>
                    <div className={`tmodal-imc-display status-${imcStatus(imcCalc ? +imcCalc : null)}`}>
                      {imcCalc ?? '—'}
                      {imcCalc && (
                        <span className="tmodal-imc-class">
                          {+imcCalc < 18.5 ? 'Abaixo do peso' :
                           +imcCalc < 25   ? 'Peso normal' :
                           +imcCalc < 30   ? 'Sobrepeso' :
                           +imcCalc < 35   ? 'Obesidade I' :
                           +imcCalc < 40   ? 'Obesidade II' : 'Obesidade III'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Complementar ─────────────────────────────────────────── */}
              <div className="tmodal-section">
                <div className="tmodal-section-title">
                  <div className="tmodal-section-icon" style={{ background: 'rgba(213,130,22,0.12)', color: '#d69e2e' }}>
                    <FlaskConical size={14} />
                  </div>
                  Complementar
                </div>
                <div className="tmodal-vitals-grid">
                  <div className="tmodal-vital-group">
                    <label><FlaskConical size={13} /> Glicemia <span className="unit">mg/dL</span></label>
                    <input type="number" min="0" max="600" placeholder="70–99 (jejum)"
                      value={form.glicemia} onChange={e => setF('glicemia', e.target.value)} className="tmodal-vital-input" />
                  </div>
                  <div className="tmodal-vital-group" style={{ gridColumn: 'span 2' }}>
                    <label><Zap size={13} /> Escala de Dor <span className="unit">0–10</span></label>
                    <div className="tmodal-dor-pills">
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button
                          key={n}
                          className={`tmodal-dor-pill ${form.dor_escala === n ? 'active' : ''}`}
                          style={{
                            '--dor-c': n === 0 ? '#38a169' : n <= 3 ? '#68d391' : n <= 5 ? '#d69e2e' : n <= 7 ? '#dd6b20' : '#e53e3e'
                          } as React.CSSProperties}
                          onClick={() => setF('dor_escala', form.dor_escala === n ? null : n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Observações</label>
                  <textarea
                    rows={2}
                    placeholder="Observações adicionais..."
                    value={form.observacoes}
                    onChange={e => setF('observacoes', e.target.value)}
                  />
                </div>
              </div>

            </div>{/* end tmodal-body */}

            {/* Modal footer */}
            <div className="tmodal-footer">
              <button className="tmodal-btn-cancel" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button
                className="tmodal-btn-save"
                disabled={!selectedPac || saving}
                onClick={save}
              >
                {saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Registrar triagem'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

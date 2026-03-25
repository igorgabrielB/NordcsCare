import { useState, useEffect } from 'react'
import api from '../../services/api'

interface Anamnese {
  id: number
  queixa_principal: string
  historico_ocular: string
  historico_familiar: string
  alergias: string
  medicamentos_em_uso: string
  cirurgias_anteriores: string
  observacoes: string
  medico_nome: string
  medico_role?: string
  created_at: string
}

function rolePrefix(role?: string) {
  switch (role) {
    case 'medico': return 'Dr(a).'
    case 'administrativo': return 'Assist.'
    case 'admin': return 'Adm.'
    default: return ''
  }
}

export default function AnamneseTab({ pacienteId }: { pacienteId: number }) {
  const [items, setItems] = useState<Anamnese[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({
    queixa_principal: '',
    historico_ocular: '',
    historico_familiar: '',
    alergias: '',
    medicamentos_em_uso: '',
    cirurgias_anteriores: '',
    observacoes: '',
  })

  useEffect(() => { load() }, [pacienteId])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t) } }, [error])
  useEffect(() => { if (fieldErrors.size > 0) { const t = setTimeout(() => setFieldErrors(new Set()), 3000); return () => clearTimeout(t) } }, [fieldErrors])

  async function load() {
    const { data } = await api.get(`/prontuario/${pacienteId}/anamneses`)
    setItems(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const campos: string[] = []
    if (!form.queixa_principal.trim()) campos.push('queixa_principal')
    if (!form.historico_ocular.trim()) campos.push('historico_ocular')
    if (!form.historico_familiar.trim()) campos.push('historico_familiar')
    if (!form.alergias.trim()) campos.push('alergias')
    if (!form.medicamentos_em_uso.trim()) campos.push('medicamentos_em_uso')
    if (!form.cirurgias_anteriores.trim()) campos.push('cirurgias_anteriores')
    if (!form.observacoes.trim()) campos.push('observacoes')
    if (campos.length > 0) {
      setFieldErrors(new Set(campos))
      setError('Preencha todos os campos obrigatórios destacados.')
      return
    }
    setSaving(true)
    try {
      await api.post(`/prontuario/${pacienteId}/anamneses`, form)
      setForm({ queixa_principal: '', historico_ocular: '', historico_familiar: '', alergias: '', medicamentos_em_uso: '', cirurgias_anteriores: '', observacoes: '' })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="tab-header">
        <h3>Anamneses</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nova Anamnese'}
        </button>
      </div>

      {showForm && (
        <form className="clinical-form" onSubmit={handleSubmit}>
          {error && (
            <div className="toast toast-error" style={{position:'relative',top:0,left:0,transform:'none',marginBottom:'1rem'}}>
              <span>{error}</span>
              <button className="toast-close" onClick={() => setError('')}>&times;</button>
            </div>
          )}
          <div className={`form-group${fieldErrors.has('queixa_principal') ? ' field-error' : ''}`}>
            <label>Queixa Principal *</label>
            <textarea rows={3} value={form.queixa_principal} onChange={e => setForm({ ...form, queixa_principal: e.target.value })} />
          </div>
          <div className="form-row">
            <div className={`form-group${fieldErrors.has('historico_ocular') ? ' field-error' : ''}`}>
              <label>Histórico Ocular *</label>
              <textarea rows={2} value={form.historico_ocular} onChange={e => setForm({ ...form, historico_ocular: e.target.value })} />
            </div>
            <div className={`form-group${fieldErrors.has('historico_familiar') ? ' field-error' : ''}`}>
              <label>Histórico Familiar *</label>
              <textarea rows={2} value={form.historico_familiar} onChange={e => setForm({ ...form, historico_familiar: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className={`form-group${fieldErrors.has('alergias') ? ' field-error' : ''}`}>
              <label>Alergias *</label>
              <input value={form.alergias} onChange={e => setForm({ ...form, alergias: e.target.value })} />
            </div>
            <div className={`form-group${fieldErrors.has('medicamentos_em_uso') ? ' field-error' : ''}`}>
              <label>Medicamentos em Uso *</label>
              <input value={form.medicamentos_em_uso} onChange={e => setForm({ ...form, medicamentos_em_uso: e.target.value })} />
            </div>
          </div>
          <div className={`form-group${fieldErrors.has('cirurgias_anteriores') ? ' field-error' : ''}`}>
            <label>Cirurgias Anteriores *</label>
            <input value={form.cirurgias_anteriores} onChange={e => setForm({ ...form, cirurgias_anteriores: e.target.value })} />
          </div>
          <div className={`form-group${fieldErrors.has('observacoes') ? ' field-error' : ''}`}>
            <label>Observações *</label>
            <textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Anamnese'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="empty-msg">Nenhuma anamnese registrada.</p>
      ) : (
        <div className="clinical-list">
          {items.map(a => (
            <div key={a.id} className="clinical-card">
              <div className="clinical-card-header">
                <span className="clinical-date">{new Date(a.created_at).toLocaleDateString('pt-BR')} {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="clinical-medico">{rolePrefix(a.medico_role)} {a.medico_nome}</span>
              </div>
              <div className="clinical-card-body">
                <p><strong>Queixa Principal:</strong> {a.queixa_principal}</p>
                {a.historico_ocular && <p><strong>Hist. Ocular:</strong> {a.historico_ocular}</p>}
                {a.historico_familiar && <p><strong>Hist. Familiar:</strong> {a.historico_familiar}</p>}
                {a.alergias && <p><strong>Alergias:</strong> {a.alergias}</p>}
                {a.medicamentos_em_uso && <p><strong>Medicamentos:</strong> {a.medicamentos_em_uso}</p>}
                {a.cirurgias_anteriores && <p><strong>Cirurgias:</strong> {a.cirurgias_anteriores}</p>}
                {a.observacoes && <p><strong>Obs:</strong> {a.observacoes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

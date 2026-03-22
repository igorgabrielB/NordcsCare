import { useState, useEffect } from 'react'
import api from '../../services/api'

interface Laudo {
  id: number
  diagnostico: string
  conduta: string
  observacoes: string
  medico_nome: string
  created_at: string
}

const CONDUTAS = [
  { value: 'alta', label: 'Alta' },
  { value: 'prescricao_oculos', label: 'Prescrição de Óculos' },
  { value: 'encaminhamento', label: 'Encaminhamento' },
  { value: 'retorno', label: 'Retorno' },
]

export default function LaudosTab({ pacienteId }: { pacienteId: number }) {
  const [items, setItems] = useState<Laudo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    diagnostico: '',
    conduta: 'alta',
    observacoes: '',
  })

  useEffect(() => { load() }, [pacienteId])

  async function load() {
    const { data } = await api.get(`/prontuario/${pacienteId}/laudos`)
    setItems(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/prontuario/${pacienteId}/laudos`, form)
      setForm({ diagnostico: '', conduta: 'alta', observacoes: '' })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  function condutaLabel(val: string) {
    return CONDUTAS.find(c => c.value === val)?.label ?? val
  }

  function condutaColor(val: string) {
    switch (val) {
      case 'alta': return '#38a169'
      case 'prescricao_oculos': return '#3182ce'
      case 'encaminhamento': return '#d69e2e'
      case 'retorno': return '#805ad5'
      default: return '#718096'
    }
  }

  return (
    <div>
      <div className="tab-header">
        <h3>Laudos</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Novo Laudo'}
        </button>
      </div>

      {showForm && (
        <form className="clinical-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Diagnóstico</label>
            <textarea rows={3} value={form.diagnostico} onChange={e => setForm({ ...form, diagnostico: e.target.value })} placeholder="Descreva o diagnóstico..." />
          </div>
          <div className="form-group" style={{ maxWidth: 280 }}>
            <label>Conduta *</label>
            <select value={form.conduta} onChange={e => setForm({ ...form, conduta: e.target.value })}>
              {CONDUTAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Observações</label>
            <textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Laudo'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="empty-msg">Nenhum laudo registrado.</p>
      ) : (
        <div className="clinical-list">
          {items.map(l => (
            <div key={l.id} className="clinical-card">
              <div className="clinical-card-header">
                <span className="clinical-date">{new Date(l.created_at).toLocaleDateString('pt-BR')} {new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="clinical-medico">Dr(a). {l.medico_nome}</span>
              </div>
              <div className="clinical-card-body">
                {l.diagnostico && <p><strong>Diagnóstico:</strong> {l.diagnostico}</p>}
                <p>
                  <strong>Conduta:</strong>{' '}
                  <span className="conduta-badge" style={{ backgroundColor: condutaColor(l.conduta) }}>
                    {condutaLabel(l.conduta)}
                  </span>
                </p>
                {l.observacoes && <p><strong>Obs:</strong> {l.observacoes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

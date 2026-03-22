import { useState, useEffect } from 'react'
import api from '../../services/api'

interface Prescricao {
  id: number
  tipo: string
  od_esferico: string
  od_cilindrico: string
  od_eixo: string
  od_adicao: string
  oe_esferico: string
  oe_cilindrico: string
  oe_eixo: string
  oe_adicao: string
  dp: string
  observacoes: string
  medico_nome: string
  created_at: string
}

export default function PrescricaoTab({ pacienteId }: { pacienteId: number }) {
  const [items, setItems] = useState<Prescricao[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tipo: 'oculos',
    od_esferico: '', od_cilindrico: '', od_eixo: '', od_adicao: '',
    oe_esferico: '', oe_cilindrico: '', oe_eixo: '', oe_adicao: '',
    dp: '',
    observacoes: '',
  })

  useEffect(() => { load() }, [pacienteId])

  async function load() {
    const { data } = await api.get(`/prontuario/${pacienteId}/prescricoes`)
    setItems(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/prontuario/${pacienteId}/prescricoes`, form)
      setForm({ tipo: 'oculos', od_esferico: '', od_cilindrico: '', od_eixo: '', od_adicao: '', oe_esferico: '', oe_cilindrico: '', oe_eixo: '', oe_adicao: '', dp: '', observacoes: '' })
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value })
  }

  return (
    <div>
      <div className="tab-header">
        <h3>Prescrições</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nova Prescrição'}
        </button>
      </div>

      {showForm && (
        <form className="clinical-form" onSubmit={handleSubmit}>
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label>Tipo</label>
            <select value={form.tipo} onChange={f('tipo')}>
              <option value="oculos">Óculos</option>
              <option value="lentes_contato">Lente de Contato</option>
            </select>
          </div>

          <div className="rx-table">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Esférico</th>
                  <th>Cilíndrico</th>
                  <th>Eixo</th>
                  <th>Adição</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="eye-label">OD</td>
                  <td><input type="text" value={form.od_esferico} onChange={f('od_esferico')} placeholder="+0.00" /></td>
                  <td><input type="text" value={form.od_cilindrico} onChange={f('od_cilindrico')} placeholder="-0.00" /></td>
                  <td><input type="text" value={form.od_eixo} onChange={f('od_eixo')} placeholder="0°" /></td>
                  <td><input type="text" value={form.od_adicao} onChange={f('od_adicao')} placeholder="+0.00" /></td>
                </tr>
                <tr>
                  <td className="eye-label">OE</td>
                  <td><input type="text" value={form.oe_esferico} onChange={f('oe_esferico')} placeholder="+0.00" /></td>
                  <td><input type="text" value={form.oe_cilindrico} onChange={f('oe_cilindrico')} placeholder="-0.00" /></td>
                  <td><input type="text" value={form.oe_eixo} onChange={f('oe_eixo')} placeholder="0°" /></td>
                  <td><input type="text" value={form.oe_adicao} onChange={f('oe_adicao')} placeholder="+0.00" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="form-group" style={{ maxWidth: 120 }}>
            <label>DP (mm)</label>
            <input type="text" value={form.dp} onChange={f('dp')} placeholder="63" />
          </div>

          <div className="form-group">
            <label>Observações</label>
            <textarea rows={2} value={form.observacoes} onChange={f('observacoes')} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Prescrição'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="empty-msg">Nenhuma prescrição registrada.</p>
      ) : (
        <div className="clinical-list">
          {items.map(p => (
            <div key={p.id} className="clinical-card">
              <div className="clinical-card-header">
                <span className="clinical-date">{new Date(p.created_at).toLocaleDateString('pt-BR')} {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="clinical-medico">Dr(a). {p.medico_nome}</span>
              </div>
              <div className="clinical-card-body">
                <p><strong>Tipo:</strong> {p.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'}</p>
                <div className="rx-table rx-table-readonly">
                  <table>
                    <thead>
                      <tr><th></th><th>Esf</th><th>Cil</th><th>Eixo</th><th>Add</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="eye-label">OD</td>
                        <td>{p.od_esferico || '—'}</td>
                        <td>{p.od_cilindrico || '—'}</td>
                        <td>{p.od_eixo || '—'}</td>
                        <td>{p.od_adicao || '—'}</td>
                      </tr>
                      <tr>
                        <td className="eye-label">OE</td>
                        <td>{p.oe_esferico || '—'}</td>
                        <td>{p.oe_cilindrico || '—'}</td>
                        <td>{p.oe_eixo || '—'}</td>
                        <td>{p.oe_adicao || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {p.dp && <p><strong>DP:</strong> {p.dp} mm</p>}
                {p.observacoes && <p><strong>Obs:</strong> {p.observacoes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

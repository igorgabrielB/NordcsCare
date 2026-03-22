import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import './Medicos.css'

interface Medico {
  id: number
  nome: string
  crm: string
  uf: string
  especialidade: string
  telefone: string | null
  email: string | null
  ativo: number
  created_at: string
}

interface FormData {
  nome: string
  crm: string
  uf: string
  especialidade: string
  telefone: string
  email: string
  login: string
  senha: string
  ativo: number
}

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

const emptyForm: FormData = { nome: '', crm: '', uf: 'CE', especialidade: 'Oftalmologia', telefone: '', email: '', login: '', senha: '', ativo: 1 }

function generateLogin(nomeCompleto: string): string {
  if (!nomeCompleto.trim()) return ''
  const partes = nomeCompleto.trim().split(/\s+/)
  if (partes.length < 2) return partes[0].toLowerCase()
  const primeiroNome = partes[0].toLowerCase()
  const primeiraLetraSobrenome = partes[partes.length - 1].charAt(0).toUpperCase()
  return `${primeiroNome}.${primeiraLetraSobrenome}`
}

export default function Medicos() {
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const fetchMedicos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/medicos')
      setMedicos(res.data)
    } catch {
      console.error('Erro ao carregar médicos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMedicos() }, [fetchMedicos])

  const filtered = medicos.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.crm.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (m: Medico) => {
    setEditId(m.id)
    setForm({
      nome: m.nome,
      crm: m.crm,
      uf: m.uf || 'CE',
      especialidade: m.especialidade || 'Oftalmologia',
      telefone: m.telefone || '',
      email: m.email || '',
      login: '',
      senha: '',
      ativo: m.ativo,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim() || !form.crm.trim()) {
      alert('Nome e CRM são obrigatórios')
      return
    }
    if (!editId && !form.senha.trim()) {
      alert('Senha é obrigatória para novo médico')
      return
    }

    setSaving(true)
    try {
      if (editId) {
        await api.put(`/medicos/${editId}`, {
          nome: form.nome,
          crm: form.crm,
          uf: form.uf,
          especialidade: form.especialidade,
          telefone: form.telefone || null,
          email: form.email || null,
          ativo: form.ativo,
        })
      } else {
        const loginGerado = generateLogin(form.nome)
        await api.post('/medicos', {
          nome: form.nome,
          crm: form.crm,
          uf: form.uf,
          especialidade: form.especialidade,
          telefone: form.telefone || null,
          email: form.email || null,
          login: loginGerado,
          senha: form.senha,
        })
      }
      setShowModal(false)
      fetchMedicos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: Medico) => {
    if (!window.confirm(`Excluir o(a) Dr(a). "${m.nome}"?`)) return
    try {
      await api.delete(`/medicos/${m.id}`)
      fetchMedicos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao excluir'
      alert(msg)
    }
  }

  return (
    <div className="medicos-page">
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/admin" className="btn btn-secondary btn-sm btn-back">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <h1>Cadastro de Médicos</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Novo Médico</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nome ou CRM..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="medicos-table-container">
          <table className="medicos-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CRM</th>
                <th>Especialidade</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">Nenhum médico cadastrado</td></tr>
              ) : filtered.map(m => (
                <tr key={m.id}>
                  <td>Dr(a). {m.nome}</td>
                  <td><span className="crm-badge">{m.crm}</span></td>
                  <td>{m.especialidade}</td>
                  <td>{m.telefone || '—'}</td>
                  <td>{m.email || '—'}</td>
                  <td>
                    <span className={`badge ${m.ativo ? 'badge-ativo' : 'badge-inativo'}`}>
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>
                      <Pencil size={14} style={{verticalAlign:'middle',marginRight:3}} />Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m)}>
                      <Trash2 size={14} style={{verticalAlign:'middle',marginRight:3}} />Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Editar Médico' : 'Novo Médico'}</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>Nome Completo *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do médico" />
              </div>
              <div className="form-row-modal">
                <div className="form-group">
                  <label>CRM *</label>
                  <input value={form.crm} onChange={e => setForm({ ...form, crm: e.target.value })} placeholder="Ex: 12345" />
                </div>
                <div className="form-group">
                  <label>UF *</label>
                  <select value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value })}>
                    {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Especialidade</label>
                <input value={form.especialidade} onChange={e => setForm({ ...form, especialidade: e.target.value })} placeholder="Oftalmologia" />
              </div>
              <div className="form-row-modal">
                <div className="form-group">
                  <label>Telefone</label>
                  <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(85) 99999-0000" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="medico@email.com" />
                </div>
              </div>
              {!editId && (
                <div className="form-row-modal">
                  <div className="form-group">
                    <label>Login (auto-gerado) *</label>
                    <input type="text" value={generateLogin(form.nome)} readOnly disabled placeholder="nome.S" />
                  </div>
                  <div className="form-group">
                    <label>Senha para Login *</label>
                    <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 4 caracteres" />
                  </div>
                </div>
              )}
              {editId && (
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.ativo} onChange={e => setForm({ ...form, ativo: Number(e.target.value) })}>
                    <option value={1}>Ativo</option>
                    <option value={0}>Inativo</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

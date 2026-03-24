import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, Pencil, Trash2, Plus, Search, Stethoscope, UserCheck, UserX, Phone, Mail, ShieldCheck } from 'lucide-react'
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

  const stats = useMemo(() => ({
    total: medicos.length,
    ativos: medicos.filter(m => m.ativo).length,
    inativos: medicos.filter(m => !m.ativo).length,
  }), [medicos])

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
      {/* Hero Header */}
      <div className="med-hero">
        <div className="med-hero-top">
          <Link to="/admin" className="btn btn-secondary btn-sm med-btn-back">
            <ArrowLeft size={16} />
          </Link>
          <button className="btn btn-primary med-btn-novo" onClick={openCreate}>
            <Plus size={16} />
            <span>Novo Médico</span>
          </button>
        </div>
        <div className="med-hero-content">
          <div className="med-hero-icon">
            <Stethoscope size={28} />
          </div>
          <div>
            <h1>Cadastro de Médicos</h1>
            <p className="med-hero-subtitle">Gerencie a equipe médica do sistema</p>
          </div>
        </div>
        <div className="med-stats-row">
          <div className="med-stat">
            <span className="med-stat-value">{stats.total}</span>
            <span className="med-stat-label">Total</span>
          </div>
          <div className="med-stat">
            <span className="med-stat-value med-stat-ativo">{stats.ativos}</span>
            <span className="med-stat-label">Ativos</span>
          </div>
          <div className="med-stat">
            <span className="med-stat-value med-stat-inativo">{stats.inativos}</span>
            <span className="med-stat-label">Inativos</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="med-toolbar">
        <div className="med-search-box">
          <Search size={16} className="med-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome ou CRM..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="med-loading">
          <div className="med-loading-spinner" />
          <p>Carregando médicos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="med-empty">
          <div className="med-empty-icon">
            <Stethoscope size={48} strokeWidth={1.5} />
          </div>
          <h3>{medicos.length === 0 ? 'Nenhum médico cadastrado' : 'Nenhum resultado encontrado'}</h3>
          <p>{medicos.length === 0 ? 'Adicione médicos para começar' : 'Tente outra busca'}</p>
          {medicos.length === 0 && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} style={{ marginRight: 6 }} />Cadastrar primeiro médico
            </button>
          )}
        </div>
      ) : (
        <div className="med-table-container">
          <table className="med-table">
            <thead>
              <tr>
                <th>Médico</th>
                <th>CRM</th>
                <th>Especialidade</th>
                <th>Contato</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, index) => (
                <tr key={m.id} style={{ animationDelay: `${index * 0.03}s` }}>
                  <td>
                    <div className="med-nome-cell">
                      <div className="med-avatar">
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="med-nome">Dr(a). {m.nome}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="crm-badge"><ShieldCheck size={12} /> {m.crm}/{m.uf}</span></td>
                  <td><span className="med-especialidade">{m.especialidade}</span></td>
                  <td>
                    <div className="med-contato-cell">
                      {m.telefone && <span className="med-contato-item"><Phone size={12} /> {m.telefone}</span>}
                      {m.email && <span className="med-contato-item"><Mail size={12} /> {m.email}</span>}
                      {!m.telefone && !m.email && <span className="med-contato-vazio">—</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`med-status-badge ${m.ativo ? 'med-status-ativo' : 'med-status-inativo'}`}>
                      {m.ativo ? <><UserCheck size={12} /> Ativo</> : <><UserX size={12} /> Inativo</>}
                    </span>
                  </td>
                  <td>
                    <div className="med-actions">
                      <button className="med-action-btn" title="Editar" onClick={() => openEdit(m)}>
                        <Pencil size={14} />
                      </button>
                      <button className="med-action-btn med-action-danger" title="Excluir" onClick={() => handleDelete(m)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="med-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="med-modal" onClick={e => e.stopPropagation()}>
            <div className="med-modal-header">
              <div className="med-modal-header-icon">
                {editId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editId ? 'Editar Médico' : 'Novo Médico'}</h3>
                <p className="med-modal-header-sub">{editId ? 'Atualize os dados do médico' : 'Preencha os dados para cadastrar'}</p>
              </div>
              <button className="med-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="med-modal-body">
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
            <div className="med-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

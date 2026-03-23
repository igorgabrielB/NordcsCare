import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft } from 'lucide-react'
import './Usuarios.css'

interface Usuario {
  id: number
  nome: string
  email: string | null
  login: string
  role: string
  ativo: number
  created_at: string
}

interface FormData {
  nome: string
  email: string
  login: string
  senha: string
  role: string
  ativo: number
}

const emptyForm: FormData = { nome: '', email: '', login: '', senha: '', role: 'administrativo', ativo: 1 }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/usuarios')
      setUsuarios(res.data)
    } catch {
      console.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsuarios() }, [fetchUsuarios])

  const filtered = usuarios.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.login.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (u: Usuario) => {
    setEditId(u.id)
    setForm({ nome: u.nome, email: u.email || '', login: u.login, senha: '', role: u.role, ativo: u.ativo })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim() || !form.login.trim()) {
      alert('Nome e login são obrigatórios')
      return
    }
    if (!editId && !form.senha) {
      alert('Senha é obrigatória para novo usuário')
      return
    }

    setSaving(true)
    try {
      if (editId) {
        const payload: Record<string, unknown> = { nome: form.nome, email: form.email || null, login: form.login, role: form.role, ativo: form.ativo }
        if (form.senha) payload.senha = form.senha
        await api.put(`/usuarios/${editId}`, payload)
      } else {
        await api.post('/usuarios', { nome: form.nome, email: form.email || null, login: form.login, senha: form.senha, role: form.role })
      }
      setShowModal(false)
      fetchUsuarios()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: Usuario) => {
    if (!window.confirm(`Excluir usuário "${u.nome}"?`)) return
    try {
      await api.delete(`/usuarios/${u.id}`)
      fetchUsuarios()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao excluir'
      alert(msg)
    }
  }

  const roleBadge = (role: string) => {
    const cls = role === 'admin' ? 'badge-admin' : role === 'medico' ? 'badge-medico' : 'badge-administrativo'
    return <span className={`badge ${cls}`}>{role}</span>
  }

  return (
    <div className="usuarios-page">
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/admin" className="btn btn-secondary btn-sm btn-back">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <h1>Usuários</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Novo Usuário</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por nome ou login..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div className="usuarios-table-container">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">Nenhum usuário encontrado</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.login}</td>
                  <td>{u.email || '—'}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>
                    <span className={`badge ${u.ativo ? 'badge-ativo' : 'badge-inativo'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>Excluir</button>
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
            <h2>{editId ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Login *</label>
                <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{editId ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Perfil</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="medico">Médico</option>
                  <option value="administrativo">Administrativo</option>
                </select>
              </div>
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

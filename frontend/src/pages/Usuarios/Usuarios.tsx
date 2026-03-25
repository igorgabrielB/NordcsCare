import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, Pencil, Trash2, Plus, Search, Users, UserCheck, UserX, Shield, Mail } from 'lucide-react'
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
  senha: string
  role: string
  ativo: number
}

const emptyForm: FormData = { nome: '', email: '', senha: '', role: 'administrativo', ativo: 1 }

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
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = useMemo(() => ({
    total: usuarios.length,
    ativos: usuarios.filter(u => u.ativo).length,
    inativos: usuarios.filter(u => !u.ativo).length,
  }), [usuarios])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (u: Usuario) => {
    setEditId(u.id)
    setForm({ nome: u.nome, email: u.email || '', senha: '', role: u.role, ativo: u.ativo })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim() || !form.email.trim()) {
      alert('Nome e email são obrigatórios')
      return
    }
    if (!editId && !form.senha) {
      alert('Senha é obrigatória para novo usuário')
      return
    }

    setSaving(true)
    try {
      if (editId) {
        const payload: Record<string, unknown> = { nome: form.nome, email: form.email, role: form.role, ativo: form.ativo }
        if (form.senha) payload.senha = form.senha
        await api.put(`/usuarios/${editId}`, payload)
      } else {
        await api.post('/usuarios', { nome: form.nome, email: form.email, senha: form.senha, role: form.role })
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
    const icon = role === 'admin' ? <Shield size={12} /> : role === 'medico' ? <UserCheck size={12} /> : <Users size={12} />
    const cls = role === 'admin' ? 'usr-badge-admin' : role === 'medico' ? 'usr-badge-medico' : 'usr-badge-administrativo'
    return <span className={`usr-role-badge ${cls}`}>{icon} {role}</span>
  }

  return (
    <div className="usuarios-page">
      {/* Hero Header */}
      <div className="usr-hero">
        <div className="usr-hero-top">
          <Link to="/admin" className="btn btn-secondary btn-sm usr-btn-back">
            <ArrowLeft size={16} />
          </Link>
          <button className="btn btn-primary usr-btn-novo" onClick={openCreate}>
            <Plus size={16} />
            <span>Novo Usuário</span>
          </button>
        </div>
        <div className="usr-hero-content">
          <div className="usr-hero-icon">
            <Users size={28} />
          </div>
          <div>
            <h1>Cadastro de Usuários</h1>
            <p className="usr-hero-subtitle">Gerencie os usuários do sistema</p>
          </div>
        </div>
        <div className="usr-stats-row">
          <div className="usr-stat">
            <span className="usr-stat-value">{stats.total}</span>
            <span className="usr-stat-label">Total</span>
          </div>
          <div className="usr-stat">
            <span className="usr-stat-value usr-stat-ativo">{stats.ativos}</span>
            <span className="usr-stat-label">Ativos</span>
          </div>
          <div className="usr-stat">
            <span className="usr-stat-value usr-stat-inativo">{stats.inativos}</span>
            <span className="usr-stat-label">Inativos</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="usr-toolbar">
        <div className="usr-search-box">
          <Search size={16} className="usr-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="usr-loading">
          <div className="usr-loading-spinner" />
          <p>Carregando usuários...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="usr-empty">
          <div className="usr-empty-icon">
            <Users size={48} strokeWidth={1.5} />
          </div>
          <h3>{usuarios.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum resultado encontrado'}</h3>
          <p>{usuarios.length === 0 ? 'Adicione usuários para começar' : 'Tente outra busca'}</p>
          {usuarios.length === 0 && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} style={{ marginRight: 6 }} />Cadastrar primeiro usuário
            </button>
          )}
        </div>
      ) : (
        <div className="usr-table-container">
          <table className="usr-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, index) => (
                <tr key={u.id} style={{ animationDelay: `${index * 0.03}s` }}>
                  <td>
                    <div className="usr-nome-cell">
                      <div className="usr-avatar">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="usr-nome">{u.nome}</span>
                    </div>
                  </td>
                  <td>
                    <span className="usr-email"><Mail size={13} /> {u.email || '—'}</span>
                  </td>
                  <td>{roleBadge(u.role)}</td>
                  <td>
                    <span className={`usr-status-badge ${u.ativo ? 'usr-status-ativo' : 'usr-status-inativo'}`}>
                      {u.ativo ? <><UserCheck size={12} /> Ativo</> : <><UserX size={12} /> Inativo</>}
                    </span>
                  </td>
                  <td>
                    <div className="usr-actions">
                      <button className="usr-action-btn" title="Editar" onClick={() => openEdit(u)}>
                        <Pencil size={14} />
                      </button>
                      <button className="usr-action-btn usr-action-danger" title="Excluir" onClick={() => handleDelete(u)}>
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
        <div className="usr-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="usr-modal" onClick={e => e.stopPropagation()}>
            <div className="usr-modal-header">
              <div className="usr-modal-header-icon">
                {editId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                <p className="usr-modal-header-sub">{editId ? 'Atualize os dados do usuário' : 'Preencha os dados para cadastrar'}</p>
              </div>
              <button className="usr-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="usr-modal-body">
              <div className="form-group">
                <label>Nome *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
              </div>
              <div className="usr-form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@email.com" />
                </div>
                <div className="form-group">
                  <label>{editId ? 'Nova Senha (opcional)' : 'Senha *'}</label>
                  <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder={editId ? 'Manter atual' : 'Mínimo 8 caracteres'} />
                </div>
              </div>
              <div className="usr-form-row">
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
            </div>
            <div className="usr-modal-footer">
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

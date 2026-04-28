import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Users, UserPlus, X } from 'lucide-react'
import './Clinicas.css'

interface Clinica {
  id: number
  nome: string
  slug: string
  ativo: number
  total_usuarios: number
  created_at: string
}

interface ClinicaUsuario {
  id: number
  nome: string
  email: string
  login: string
  role: string
  home_tenant_id: number
  vinculado_em: string
}

interface AllUser {
  id: number
  nome: string
  login: string
  role: string
}

interface FormData {
  nome: string
  slug: string
  ativo: number
  login_admin: string
  senha_admin: string
  nome_admin: string
}

const emptyForm: FormData = {
  nome: '',
  slug: '',
  ativo: 1,
  login_admin: '',
  senha_admin: '',
  nome_admin: 'Administrador',
}

export default function Clinicas() {
  const { hasTela } = useAuth()

  const [items, setItems] = useState<Clinica[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [usersClinicId, setUsersClinicId] = useState<number | null>(null)
  const [usersClinicNome, setUsersClinicNome] = useState('')
  const [clinicUsers, setClinicUsers] = useState<ClinicaUsuario[]>([])
  const [allUsers, setAllUsers] = useState<AllUser[]>([])
  const [addUserId, setAddUserId] = useState<number | ''>('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get('/clinicas')
      setItems(res.data)
    } catch {
      setError('Erro ao carregar clÃ­nicas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openNew = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setError('')
    setShowModal(true)
  }

  const openEdit = (c: Clinica) => {
    setEditId(c.id)
    setForm({
      nome: c.nome,
      slug: c.slug,
      ativo: c.ativo,
      login_admin: '',
      senha_admin: '',
      nome_admin: 'Administrador',
    })
    setError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditId(null)
    setError('')
  }

  const handleSave = async () => {
    if (!form.nome.trim()) {
      setError('Nome Ã© obrigatÃ³rio')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editId) {
        await api.put(`/clinicas/${editId}`, {
          nome: form.nome,
          ativo: form.ativo,
        })
      } else {
        await api.post('/clinicas', {
          nome: form.nome,
          slug: form.slug || undefined,
          login_admin: form.login_admin || undefined,
          senha_admin: form.senha_admin || undefined,
          nome_admin: form.nome_admin || undefined,
        })
      }
      closeModal()
      fetchItems()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Clinica) => {
    if (c.id === 1) return
    if (!confirm(`Remover a clÃ­nica "${c.nome}"? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`)) return

    try {
      await api.delete(`/clinicas/${c.id}`)
      fetchItems()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover')
    }
  }

  const openUsersPanel = async (c: Clinica) => {
    setUsersClinicId(c.id)
    setUsersClinicNome(c.nome)
    setUsersError('')
    setAddUserId('')
    setUsersLoading(true)
    try {
      const [usersRes, allRes] = await Promise.all([
        api.get(`/clinicas/${c.id}/usuarios`),
        api.get('/usuarios'),
      ])
      setClinicUsers(usersRes.data)
      setAllUsers(allRes.data)
    } catch {
      setUsersError('Erro ao carregar usuÃ¡rios')
    } finally {
      setUsersLoading(false)
    }
  }

  const closeUsersPanel = () => {
    setUsersClinicId(null)
    setClinicUsers([])
    setAllUsers([])
  }

  const handleAddUser = async () => {
    if (!addUserId || !usersClinicId) return
    try {
      await api.post(`/clinicas/${usersClinicId}/usuarios`, { usuario_id: addUserId })
      setAddUserId('')
      // Refresh
      const res = await api.get(`/clinicas/${usersClinicId}/usuarios`)
      setClinicUsers(res.data)
      fetchItems()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao vincular')
    }
  }

  const handleRemoveUser = async (userId: number) => {
    if (!usersClinicId) return
    if (!confirm('Remover vÃ­nculo deste usuÃ¡rio com esta clÃ­nica?')) return
    try {
      await api.delete(`/clinicas/${usersClinicId}/usuarios`, { data: { usuario_id: userId } })
      const res = await api.get(`/clinicas/${usersClinicId}/usuarios`)
      setClinicUsers(res.data)
      fetchItems()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover vÃ­nculo')
    }
  }

  if (loading) return <div className="clinicas-loading">Carregando...</div>

  const totalAtivas = items.filter(i => i.ativo).length

  return (
    <div className="clinicas-page">
      <div className="clinicas-header">
        <div className="clinicas-header-left">
          <Link to="/admin" className="clinicas-back">
            <ArrowLeft size={18} />
          </Link>
          <h1>ClÃ­nicas</h1>
        </div>
        {hasTela('clinicas') && (
          <button className="clinicas-btn-add" onClick={openNew}>
            <Plus size={16} /> Nova ClÃ­nica
          </button>
        )}
      </div>

      <div className="clinicas-stats">
        <div className="clinicas-stat">
          Total: <strong>{items.length}</strong>
        </div>
        <div className="clinicas-stat">
          Ativas: <strong>{totalAtivas}</strong>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="clinicas-empty">Nenhuma clÃ­nica cadastrada</div>
      ) : (
        <div className="clinicas-list">
          {items.map(c => (
            <div key={c.id} className="clinicas-card">
              <div className="clinicas-card-info">
                <div className="clinicas-card-icon">
                  <Building2 size={20} />
                </div>
                <div className="clinicas-card-text">
                  <span className="clinicas-card-nome">{c.nome}</span>
                  <span className="clinicas-card-slug">{c.slug}</span>
                </div>
              </div>
              <div className="clinicas-card-meta">
                <span className={`clinicas-badge ${c.ativo ? 'ativo' : 'inativo'}`}>
                  {c.ativo ? 'Ativa' : 'Inativa'}
                </span>
                <span className="clinicas-card-count">
                  <Users size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {c.total_usuarios} usuÃ¡rio{c.total_usuarios !== 1 ? 's' : ''}
                </span>
                <div className="clinicas-card-actions">
                  <button onClick={() => openUsersPanel(c)} title="Gerenciar UsuÃ¡rios">
                    <UserPlus size={14} />
                  </button>
                  {hasTela('clinicas') && (
                    <button onClick={() => openEdit(c)} title="Editar">
                      <Pencil size={14} />
                    </button>
                  )}
                  {hasTela('clinicas') && c.id !== 1 && (
                    <button className="delete" onClick={() => handleDelete(c)} title="Remover">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="clinicas-modal-overlay" onClick={closeModal}>
          <div className="clinicas-modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Editar ClÃ­nica' : 'Nova ClÃ­nica'}</h2>

            {error && <div className="clinicas-error">{error}</div>}

            <div className="clinicas-form-group">
              <label>Nome da ClÃ­nica *</label>
              <input
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: ClÃ­nica SÃ£o Lucas"
                autoFocus
              />
            </div>

            {!editId && (
              <div className="clinicas-form-group">
                <label>Slug (identificador)</label>
                <input
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="auto-gerado se vazio"
                />
                <div className="clinicas-form-hint">
                  Identificador Ãºnico, apenas letras minÃºsculas, nÃºmeros e hÃ­fens
                </div>
              </div>
            )}

            {editId && (
              <div className="clinicas-form-group">
                <label>Status</label>
                <select
                  value={form.ativo}
                  onChange={e => setForm({ ...form, ativo: parseInt(e.target.value) })}
                >
                  <option value={1}>Ativa</option>
                  <option value={0}>Inativa</option>
                </select>
              </div>
            )}

            {!editId && (
              <div className="clinicas-form-section">
                <h3>UsuÃ¡rio Admin (opcional)</h3>
                <div className="clinicas-form-group">
                  <label>Nome do Admin</label>
                  <input
                    value={form.nome_admin}
                    onChange={e => setForm({ ...form, nome_admin: e.target.value })}
                    placeholder="Administrador"
                  />
                </div>
                <div className="clinicas-form-group">
                  <label>Login / Email</label>
                  <input
                    value={form.login_admin}
                    onChange={e => setForm({ ...form, login_admin: e.target.value })}
                    placeholder="admin@clinica.com"
                  />
                </div>
                <div className="clinicas-form-group">
                  <label>Senha</label>
                  <input
                    type="password"
                    value={form.senha_admin}
                    onChange={e => setForm({ ...form, senha_admin: e.target.value })}
                    placeholder="Senha do admin"
                  />
                </div>
                <div className="clinicas-form-hint">
                  Se preenchido, um usuÃ¡rio admin serÃ¡ criado automaticamente para a nova clÃ­nica
                </div>
              </div>
            )}

            <div className="clinicas-modal-actions">
              <button className="clinicas-btn-cancel" onClick={closeModal}>Cancelar</button>
              <button className="clinicas-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar ClÃ­nica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {usersClinicId && (
        <div className="clinicas-modal-overlay" onClick={closeUsersPanel}>
          <div className="clinicas-modal clinicas-modal-wide" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2><Users size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />UsuÃ¡rios â€” {usersClinicNome}</h2>
              <button onClick={closeUsersPanel} className="clinicas-btn-close"><X size={18}/></button>
            </div>

            {usersError && <div className="clinicas-error">{usersError}</div>}

            {usersLoading ? (
              <p>Carregando...</p>
            ) : (
              <>
                {hasTela('clinicas') && (
                <div className="clinicas-add-user-row">
                  <select
                    value={addUserId}
                    onChange={e => setAddUserId(e.target.value ? parseInt(e.target.value) : '')}
                  >
                    <option value="">Selecione um usuÃ¡rio para vincular...</option>
                    {allUsers
                      .filter(u => !clinicUsers.some(cu => cu.id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.nome} ({u.login}) â€” {u.role}</option>
                      ))}
                  </select>
                  <button className="clinicas-btn-add-user" onClick={handleAddUser} disabled={!addUserId}>
                    <UserPlus size={14} /> Vincular
                  </button>
                </div>
                )}

                {clinicUsers.length === 0 ? (
                  <p className="clinicas-empty">Nenhum usuÃ¡rio vinculado</p>
                ) : (
                  <table className="clinicas-users-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Login</th>
                        <th>Perfil</th>
                        <th>Tipo</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.nome}</td>
                          <td>{u.login}</td>
                          <td>{u.role}</td>
                          <td>
                            {u.home_tenant_id === usersClinicId ? (
                              <span className="clinicas-badge ativo">Principal</span>
                            ) : (
                              <span className="clinicas-badge convidado">Convidado</span>
                            )}
                          </td>
                          <td>
                            {hasTela('clinicas') && u.home_tenant_id !== usersClinicId && (
                              <button className="clinicas-btn-remove-user" onClick={() => handleRemoveUser(u.id)} title="Remover vÃ­nculo">
                                <Trash2 size={13}/>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

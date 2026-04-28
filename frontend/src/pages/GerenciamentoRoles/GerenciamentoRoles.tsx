import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, Search, Users, UserX, Save,
  Shield, Stethoscope, Briefcase, Crown, ChevronDown,
  ChevronRight, Check, Minus, AlertTriangle, X
} from 'lucide-react'
import api from '../../services/api'
import './GerenciamentoRoles.css'

interface Usuario {
  id: number
  nome: string
  login: string
  email: string
  role: string
  ativo: number
}

interface TelaInfo {
  codigo: string
  nome: string
  categoria: string
  descricao?: string
}

const CATEGORIAS: Record<string, { label: string; color: string; bg: string }> = {
  operacional: { label: 'Operacional',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  gestao:      { label: 'Gestão',       color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  academico:   { label: 'Acadêmico',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  clinico:     { label: 'Clínico',      color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  sistema:     { label: 'Sistema',      color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  geral:       { label: 'Geral',        color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

const CATEGORIA_ORDER = ['operacional', 'gestao', 'academico', 'clinico', 'sistema', 'geral']

const ROLE_INFO: Record<string, { label: string; icon: JSX.Element; cls: string }> = {
  master:        { label: 'Master',          icon: <Crown size={11} />,        cls: 'rl-badge-master' },
  admin:         { label: 'Admin',           icon: <Shield size={11} />,       cls: 'rl-badge-admin' },
  medico:        { label: 'Médico',          icon: <Stethoscope size={11} />,  cls: 'rl-badge-medico' },
  administrativo:{ label: 'Administrativo',  icon: <Briefcase size={11} />,    cls: 'rl-badge-adm' },
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rl-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function roleBadgeInfo(role: string) {
  if (role === 'master') return { icon: <Crown size={10} />, cls: 'rl-badge-master' }
  if (role === 'admin') return { icon: <Shield size={10} />, cls: 'rl-badge-admin' }
  if (role === 'medico') return { icon: <Stethoscope size={10} />, cls: 'rl-badge-medico' }
  return { icon: <Briefcase size={10} />, cls: 'rl-badge-adm' }
}

export default function GerenciamentoPermissoes() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchUser, setSearchUser] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)
  const [allTelas, setAllTelas] = useState<TelaInfo[]>([])
  const [selectedTelas, setSelectedTelas] = useState<Set<string>>(new Set())
  const [originalTelas, setOriginalTelas] = useState<Set<string>>(new Set())
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const hasChanges = useMemo(() => {
    if (selectedTelas.size !== originalTelas.size) return true
    for (const t of selectedTelas) if (!originalTelas.has(t)) return true
    return false
  }, [selectedTelas, originalTelas])

  useEffect(() => {
    api.get('/usuarios')
      .then(r => setUsuarios(r.data))
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const filteredUsers = useMemo(() =>
    usuarios.filter(u =>
      u.nome.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.login.toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchUser.toLowerCase())
    ), [usuarios, searchUser])

  const selectUser = async (u: Usuario) => {
    if (hasChanges) {
      if (!confirm('Há alterações não salvas. Deseja descartar?')) return
    }
    setSelectedUser(u)
    setAllTelas([])
    setSelectedTelas(new Set())
    setOriginalTelas(new Set())
    setCollapsedCats(new Set())
    setLoadingPerms(true)
    try {
      const [telasRes, userRes] = await Promise.all([
        api.get('/permissoes/telas'),
        api.get(`/permissoes/usuario/${u.id}`),
      ])
      const telas: TelaInfo[] = Array.isArray(telasRes.data) ? telasRes.data : []
      const userTelas: string[] = userRes.data.telas ?? []
      setAllTelas(telas)
      setSelectedTelas(new Set(userTelas))
      setOriginalTelas(new Set(userTelas))
    } catch {
      setToast({ msg: 'Erro ao carregar permissões', type: 'error' })
    } finally {
      setLoadingPerms(false)
    }
  }

  const toggleTela = (codigo: string) => {
    setSelectedTelas(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const toggleCategoria = (cat: string) => {
    const grupo = allTelas.filter(t => t.categoria === cat)
    const allSel = grupo.every(t => selectedTelas.has(t.codigo))
    setSelectedTelas(prev => {
      const next = new Set(prev)
      if (allSel) grupo.forEach(t => next.delete(t.codigo))
      else grupo.forEach(t => next.add(t.codigo))
      return next
    })
  }

  const toggleCollapsecat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const grouped = useMemo(() => {
    const map: Record<string, TelaInfo[]> = {}
    for (const t of allTelas) {
      if (!map[t.categoria]) map[t.categoria] = []
      map[t.categoria].push(t)
    }
    return map
  }, [allTelas])

  const savePerms = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await api.put(`/permissoes/usuario/${selectedUser.id}`, { telas: [...selectedTelas] })
      setOriginalTelas(new Set(selectedTelas))
      setSavedFeedback(true)
      setToast({ msg: `Permissões de ${selectedUser.nome} salvas com sucesso`, type: 'success' })
      setTimeout(() => setSavedFeedback(false), 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar'
      setToast({ msg, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const isPrivileged = selectedUser && (selectedUser.role === 'admin' || selectedUser.role === 'master')
  const totalSelecionado = selectedTelas.size
  const totalTelas = allTelas.length

  return (
    <div className="rl-page">

      {/* Toast */}
      {toast && (
        <div className={`rl-toast rl-toast-${toast.type}`}>
          {toast.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)}><X size={13} /></button>
        </div>
      )}

      {/* Header */}
      <div className="rl-header">
        <Link to="/admin" className="btn btn-secondary btn-sm rl-btn-back">
          <ArrowLeft size={16} />
        </Link>
        <div className="rl-header-icon">
          <ShieldCheck size={20} />
        </div>
        <div className="rl-header-text">
          <h1 className="rl-header-title">Permissões de Telas</h1>
          <p className="rl-header-sub">{usuarios.length} usuários · {allTelas.length > 0 ? `${allTelas.length} telas` : 'selecione um usuário'}</p>
        </div>
      </div>

      {/* Split layout */}
      <div className="rl-split">

        {/* ── Left: user list ── */}
        <aside className="rl-aside">
          <div className="rl-aside-search">
            <Search size={14} className="rl-aside-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar usuário..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
            />
            {searchUser && (
              <button className="rl-aside-search-clear" onClick={() => { setSearchUser(''); searchRef.current?.focus() }}>
                <X size={12} />
              </button>
            )}
          </div>

          {loadingUsers ? (
            <div className="rl-aside-loading">
              <div className="rl-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rl-aside-empty">
              <Users size={28} strokeWidth={1.5} />
              <span>{searchUser ? 'Nenhum resultado' : 'Nenhum usuário'}</span>
            </div>
          ) : (
            <ul className="rl-user-list">
              {filteredUsers.map(u => {
                const rInfo = ROLE_INFO[u.role] ?? ROLE_INFO.administrativo
                const isSelected = selectedUser?.id === u.id
                return (
                  <li key={u.id}>
                    <button
                      className={`rl-user-row${isSelected ? ' selected' : ''}${!u.ativo ? ' inactive' : ''}`}
                      onClick={() => selectUser(u)}
                    >
                      <div className={`rl-user-avatar rl-avatar-${u.role}`}>
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="rl-user-info">
                        <span className="rl-user-name">{highlight(u.nome, searchUser)}</span>
                        <span className="rl-user-login">{highlight(`@${u.login}`, searchUser)}</span>
                      </div>
                      <span className={`rl-role-badge ${rInfo.cls}`}>
                        {rInfo.icon}
                        <span>{rInfo.label}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="rl-aside-footer">
            <Users size={12} />
            <span>{filteredUsers.length} de {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</span>
          </div>
        </aside>

        {/* ── Right: permissions panel ── */}
        <main className="rl-main">
          {!selectedUser ? (
            <div className="rl-main-empty">
              <div className="rl-main-empty-icon">
                <ShieldCheck size={40} strokeWidth={1.2} />
              </div>
              <h2>Gerenciar permissões</h2>
              <p>Selecione um usuário na lista ao lado para visualizar e editar quais telas ele pode acessar</p>
            </div>
          ) : (
            <>
              {/* User bar */}
              <div className="rl-user-bar">
                <div className={`rl-user-bar-avatar rl-avatar-${selectedUser.role}`}>
                  {selectedUser.nome.charAt(0).toUpperCase()}
                </div>
                <div className="rl-user-bar-info">
                  <span className="rl-user-bar-name">
                    {selectedUser.nome}
                    {!selectedUser.ativo && (
                      <span className="rl-inactive-tag"><UserX size={10} /> Inativo</span>
                    )}
                    {hasChanges && (
                      <span className="rl-unsaved-tag"><AlertTriangle size={10} /> Não salvo</span>
                    )}
                  </span>
                  <span className="rl-user-bar-email">{selectedUser.email || `@${selectedUser.login}`}</span>
                </div>

                {isPrivileged ? (
                  <span className="rl-admin-notice">
                    <Shield size={13} /> Acesso total automático
                  </span>
                ) : (
                  !loadingPerms && allTelas.length > 0 && (
                    <div className="rl-bar-right">
                      <div className="rl-progress-wrap">
                        <div className="rl-progress-bar" style={{ width: `${totalTelas ? (totalSelecionado / totalTelas) * 100 : 0}%` }} />
                      </div>
                      <span className="rl-progress-label">{totalSelecionado}/{totalTelas}</span>
                      <div className="rl-bulk-actions">
                        <button className="rl-bulk-btn rl-bulk-all" onClick={() => setSelectedTelas(new Set(allTelas.map(t => t.codigo)))}>
                          <Check size={12} /> Todos
                        </button>
                        <button className="rl-bulk-btn rl-bulk-none" onClick={() => setSelectedTelas(new Set())}>
                          <Minus size={12} /> Nenhum
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Permissions body */}
              <div className="rl-perms-body">
                {loadingPerms ? (
                  <div className="rl-perms-loading-state">
                    <div className="rl-spin" />
                    <span>Carregando permissões...</span>
                  </div>
                ) : isPrivileged ? (
                  <div className="rl-admin-all">
                    <div className="rl-admin-all-icon">
                      <ShieldCheck size={28} strokeWidth={1.5} />
                    </div>
                    <strong>Acesso total</strong>
                    <p>Usuários <em>{selectedUser.role}</em> têm acesso irrestrito a todas as telas do sistema</p>
                  </div>
                ) : (
                  CATEGORIA_ORDER.filter(cat => grouped[cat]?.length).map(cat => {
                    const info = CATEGORIAS[cat] ?? { label: cat, color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
                    const grupo = grouped[cat]
                    const countSel = grupo.filter(t => selectedTelas.has(t.codigo)).length
                    const allSel = countSel === grupo.length
                    const collapsed = collapsedCats.has(cat)

                    return (
                      <div key={cat} className={`rl-cat-block${collapsed ? ' collapsed' : ''}`}>
                        <div className="rl-cat-header" onClick={() => toggleCollapsecat(cat)}>
                          <div className="rl-cat-pill" style={{ background: info.bg, color: info.color }}>
                            <div className="rl-cat-dot" style={{ background: info.color }} />
                            <span className="rl-cat-label">{info.label}</span>
                            <span className="rl-cat-fraction">{countSel}/{grupo.length}</span>
                          </div>
                          <div className="rl-cat-progress-bar-wrap">
                            <div className="rl-cat-progress-fill" style={{ width: `${grupo.length ? (countSel / grupo.length) * 100 : 0}%`, background: info.color }} />
                          </div>
                          <button
                            className="rl-cat-sel-btn"
                            onClick={e => { e.stopPropagation(); toggleCategoria(cat) }}
                          >
                            {allSel ? 'Desmarcar todos' : 'Selecionar todos'}
                          </button>
                          <span className="rl-cat-chevron">
                            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </div>

                        {!collapsed && (
                          <div className="rl-cat-checks">
                            {grupo.map(t => {
                              const active = selectedTelas.has(t.codigo)
                              return (
                                <button
                                  key={t.codigo}
                                  className={`rl-tela-card${active ? ' active' : ''}`}
                                  onClick={() => toggleTela(t.codigo)}
                                  style={{ '--cat-color': info.color } as React.CSSProperties}
                                  title={t.descricao}
                                >
                                  <div className="rl-tela-body">
                                    <span className="rl-tela-nome">{t.nome}</span>
                                    <span className="rl-tela-code">{t.codigo}</span>
                                    {t.descricao && <span className="rl-tela-desc">{t.descricao}</span>}
                                  </div>
                                  <div className={`rl-tela-switch${active ? ' on' : ''}`}>
                                    <div className="rl-tela-switch-thumb" />
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Save bar */}
              {!isPrivileged && !loadingPerms && (
                <div className="rl-save-bar">
                  <div className="rl-save-info">
                    <span className="rl-save-count">
                      <strong>{totalSelecionado}</strong> tela{totalSelecionado !== 1 ? 's' : ''} selecionada{totalSelecionado !== 1 ? 's' : ''}
                    </span>
                    {hasChanges && <span className="rl-save-changed"><AlertTriangle size={12} /> Alterações pendentes</span>}
                  </div>
                  <button
                    className={`btn btn-primary rl-save-btn${savedFeedback ? ' saved' : ''}`}
                    onClick={savePerms}
                    disabled={saving || !hasChanges}
                  >
                    {savedFeedback ? <Check size={15} /> : <Save size={15} />}
                    {savedFeedback ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Permissões'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
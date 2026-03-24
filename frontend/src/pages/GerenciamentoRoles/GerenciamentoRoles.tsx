import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Stethoscope, Briefcase, Check, X, ArrowLeft, Users, UserCheck, UserX, ChevronDown, Search, Lock } from 'lucide-react'
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

const ROLES_CONFIG = [
  {
    role: 'admin',
    label: 'Administrador',
    prefix: 'Adm.',
    icon: <Shield size={22} />,
    gradient: 'linear-gradient(135deg, #805ad5, #b794f4)',
    color: 'rgba(128,90,213,0.15)',
    iconColor: '#b794f4',
    borderColor: '#805ad5',
    description: 'Acesso completo a todas as funcionalidades do sistema',
    permissions: [
      { label: 'Acesso total ao sistema', allowed: true },
      { label: 'Gerenciar usuários e médicos', allowed: true },
      { label: 'Cadastrar/editar pacientes', allowed: true },
      { label: 'Gerenciar fila de atendimento', allowed: true },
      { label: 'Registrar acuidade visual', allowed: true },
      { label: 'Criar laudos e prescrições', allowed: true },
      { label: 'Imprimir documentos (receita, atestado)', allowed: true },
      { label: 'Relatório completo', allowed: true },
      { label: 'Importar/excluir alunos em lote', allowed: true },
    ],
  },
  {
    role: 'medico',
    label: 'Médico',
    prefix: 'Dr(a).',
    icon: <Stethoscope size={22} />,
    gradient: 'linear-gradient(135deg, #38a169, #68d391)',
    color: 'rgba(56,161,105,0.15)',
    iconColor: '#68d391',
    borderColor: '#38a169',
    description: 'Foco em laudos, prescrições e atendimentos clínicos',
    permissions: [
      { label: 'Cadastrar/editar pacientes', allowed: true },
      { label: 'Registrar acuidade visual', allowed: false },
      { label: 'Criar laudos e prescrições', allowed: true },
      { label: 'Imprimir documentos (receita, atestado)', allowed: true },
      { label: 'Gerenciar fila de atendimento', allowed: false },
      { label: 'Gerenciar usuários e médicos', allowed: false },
      { label: 'Importar/excluir alunos em lote', allowed: false },
      { label: 'Relatório completo', allowed: false },
    ],
  },
  {
    role: 'administrativo',
    label: 'Administrativo',
    prefix: 'Assist.',
    icon: <Briefcase size={22} />,
    gradient: 'linear-gradient(135deg, #d69e2e, #ecc94b)',
    color: 'rgba(214,158,46,0.15)',
    iconColor: '#ecc94b',
    borderColor: '#d69e2e',
    description: 'Gerenciamento de filas, pacientes e acuidade visual',
    permissions: [
      { label: 'Cadastrar/editar pacientes', allowed: true },
      { label: 'Gerenciar fila de atendimento', allowed: true },
      { label: 'Registrar acuidade visual', allowed: true },
      { label: 'Criar laudos e prescrições', allowed: false },
      { label: 'Imprimir documentos (receita, atestado)', allowed: false },
      { label: 'Gerenciar usuários e médicos', allowed: false },
      { label: 'Importar/excluir alunos em lote', allowed: false },
      { label: 'Relatório completo', allowed: false },
    ],
  },
]

export default function GerenciamentoRoles() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    admin: true, medico: true, administrativo: true
  })
  const [searchUser, setSearchUser] = useState('')

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    try {
      const { data } = await api.get('/usuarios')
      setUsuarios(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function changeRole(userId: number, newRole: string) {
    try {
      await api.put(`/usuarios/${userId}`, { role: newRole })
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch { alert('Erro ao alterar perfil') }
  }

  const toggleCard = (role: string) => {
    setExpandedCards(prev => ({ ...prev, [role]: !prev[role] }))
  }

  const stats = useMemo(() => ({
    total: usuarios.length,
    admins: usuarios.filter(u => u.role === 'admin').length,
    medicos: usuarios.filter(u => u.role === 'medico').length,
    administrativos: usuarios.filter(u => u.role === 'administrativo').length,
  }), [usuarios])

  return (
    <div className="roles-page">
      {/* Hero Header */}
      <div className="rl-hero">
        <div className="rl-hero-top">
          <Link to="/admin" className="btn btn-secondary btn-sm rl-btn-back">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="rl-hero-content">
          <div className="rl-hero-icon">
            <Lock size={28} />
          </div>
          <div>
            <h1>Perfis &amp; Permissões</h1>
            <p className="rl-hero-subtitle">Visualize as permissões de cada perfil e altere o perfil dos usuários</p>
          </div>
        </div>
        <div className="rl-stats-row">
          <div className="rl-stat">
            <span className="rl-stat-value">{stats.total}</span>
            <span className="rl-stat-label"><Users size={12} /> Total</span>
          </div>
          <div className="rl-stat">
            <span className="rl-stat-value" style={{ color: '#b794f4' }}>{stats.admins}</span>
            <span className="rl-stat-label"><Shield size={12} /> Admins</span>
          </div>
          <div className="rl-stat">
            <span className="rl-stat-value" style={{ color: '#68d391' }}>{stats.medicos}</span>
            <span className="rl-stat-label"><Stethoscope size={12} /> Médicos</span>
          </div>
          <div className="rl-stat">
            <span className="rl-stat-value" style={{ color: '#ecc94b' }}>{stats.administrativos}</span>
            <span className="rl-stat-label"><Briefcase size={12} /> Administrativos</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rl-loading">
          <div className="rl-loading-spinner" />
          <p>Carregando perfis...</p>
        </div>
      ) : (
        <div className="roles-grid">
          {ROLES_CONFIG.map((rc, cardIndex) => {
            const usersInRole = usuarios.filter(u => u.role === rc.role)
            const filteredUsers = usersInRole.filter(u =>
              u.nome.toLowerCase().includes(searchUser.toLowerCase()) ||
              u.login.toLowerCase().includes(searchUser.toLowerCase())
            )
            const isExpanded = expandedCards[rc.role]
            const allowedCount = rc.permissions.filter(p => p.allowed).length
            const totalPerms = rc.permissions.length

            return (
              <div
                key={rc.role}
                className="role-card"
                style={{ animationDelay: `${cardIndex * 0.08}s` }}
              >
                {/* Colored top accent */}
                <div className="role-card-accent" style={{ background: rc.gradient }} />

                {/* Header */}
                <div className="role-card-header">
                  <div className="role-card-icon" style={{ background: rc.gradient }}>
                    {rc.icon}
                  </div>
                  <div className="role-card-title">
                    <h3>{rc.label}</h3>
                    <span className="role-card-desc">{rc.description}</span>
                  </div>
                </div>

                {/* Stats ribbon */}
                <div className="role-card-ribbon">
                  <div className="role-ribbon-item">
                    <Users size={13} />
                    <span>{usersInRole.length} {usersInRole.length === 1 ? 'usuário' : 'usuários'}</span>
                  </div>
                  <div className="role-ribbon-item">
                    <Check size={13} />
                    <span>{allowedCount}/{totalPerms} permissões</span>
                  </div>
                  <div className="role-ribbon-item">
                    <span className="role-prefix-tag">Prefixo: {rc.prefix}</span>
                  </div>
                </div>

                {/* Permissions */}
                <div className="role-card-permissions">
                  <button
                    className="role-section-toggle"
                    onClick={() => toggleCard(rc.role)}
                  >
                    <h4><Lock size={13} /> Permissões</h4>
                    <ChevronDown size={16} className={`toggle-chevron ${isExpanded ? 'open' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="perm-list">
                      {rc.permissions.map((p, i) => (
                        <div key={i} className={`perm-item ${p.allowed ? 'perm-allowed' : 'perm-denied'}`}>
                          <div className={`perm-icon-wrap ${p.allowed ? 'perm-icon-yes' : 'perm-icon-no'}`}>
                            {p.allowed ? <Check size={12} /> : <X size={12} />}
                          </div>
                          <span>{p.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Users */}
                <div className="role-card-users">
                  <div className="role-users-header">
                    <h4><UserCheck size={13} /> Usuários ({usersInRole.length})</h4>
                    {usersInRole.length > 3 && (
                      <div className="role-users-search">
                        <Search size={12} />
                        <input
                          type="text"
                          placeholder="Filtrar..."
                          value={searchUser}
                          onChange={e => setSearchUser(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  {usersInRole.length === 0 ? (
                    <div className="role-user-empty">
                      <Users size={20} strokeWidth={1.5} />
                      <span>Nenhum usuário com este perfil</span>
                    </div>
                  ) : (
                    <div className="role-user-list">
                      {(searchUser ? filteredUsers : usersInRole).map(u => (
                        <div key={u.id} className="role-user-item">
                          <div className="role-user-avatar" style={{ background: rc.gradient }}>
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="role-user-info">
                            <span className="role-user-name">
                              {u.nome}
                              {u.ativo === 0 && (
                                <span className="user-status-badge inativo">
                                  <UserX size={10} /> Inativo
                                </span>
                              )}
                            </span>
                            <span className="role-user-login">@{u.login}</span>
                          </div>
                          <div className="role-user-actions">
                            <select
                              value={u.role}
                              onChange={e => changeRole(u.id, e.target.value)}
                            >
                              <option value="admin">Administrador</option>
                              <option value="medico">Médico</option>
                              <option value="administrativo">Administrativo</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

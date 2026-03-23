import { useState, useEffect } from 'react'
import { Shield, Stethoscope, Briefcase, Check, X } from 'lucide-react'
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
    icon: <Shield size={24} />,
    color: 'rgba(128,90,213,0.15)',
    iconColor: '#b794f4',
    borderColor: '#805ad5',
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
    icon: <Stethoscope size={24} />,
    color: 'rgba(56,161,105,0.15)',
    iconColor: '#68d391',
    borderColor: '#38a169',
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
    icon: <Briefcase size={24} />,
    color: 'rgba(214,158,46,0.15)',
    iconColor: '#ecc94b',
    borderColor: '#d69e2e',
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

  if (loading) return <div className="roles-page"><div className="roles-loading">Carregando...</div></div>

  return (
    <div className="roles-page">
      <div className="page-header">
        <h1>Gerenciamento de Perfis</h1>
        <p>Visualize as permissões de cada perfil e altere o perfil dos usuários</p>
      </div>

      <div className="roles-grid">
        {ROLES_CONFIG.map(rc => {
          const usersInRole = usuarios.filter(u => u.role === rc.role)
          return (
            <div key={rc.role} className="role-card" style={{ borderColor: rc.borderColor }}>
              {/* Header */}
              <div className="role-card-header">
                <div className="role-card-icon" style={{ background: rc.color, color: rc.iconColor }}>
                  {rc.icon}
                </div>
                <div className="role-card-title">
                  <h3>{rc.label}</h3>
                  <span className="role-count">
                    {usersInRole.length} {usersInRole.length === 1 ? 'usuário' : 'usuários'} · Prefixo: <strong>{rc.prefix}</strong>
                  </span>
                </div>
              </div>

              {/* Permissions */}
              <div className="role-card-permissions">
                <h4>Permissões</h4>
                <div className="perm-list">
                  {rc.permissions.map((p, i) => (
                    <div key={i} className="perm-item">
                      {p.allowed
                        ? <Check size={14} className="perm-yes" />
                        : <X size={14} className="perm-no" />}
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Users */}
              <div className="role-card-users">
                <h4>Usuários ({usersInRole.length})</h4>
                {usersInRole.length === 0 ? (
                  <p className="role-user-empty">Nenhum usuário com este perfil</p>
                ) : (
                  <div className="role-user-list">
                    {usersInRole.map(u => (
                      <div key={u.id} className="role-user-item">
                        <div className="role-user-info">
                          <span className="role-user-name">
                            {u.nome}
                            {u.ativo === 0 && <span className="user-status-badge inativo">Inativo</span>}
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
    </div>
  )
}

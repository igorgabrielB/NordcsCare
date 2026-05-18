import { useAuth } from '../../contexts/AuthContext.tsx'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronDown, X, Building2, LogOut, LayoutGrid } from 'lucide-react'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import api from '../../services/api.ts'

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Médico',
  administrativo: 'Administrativo',
  master: 'Master',
}

const roleColors: Record<string, string> = {
  master:         'linear-gradient(135deg, #f59e0b, #d97706)',
  admin:          'linear-gradient(135deg, #7345d6, #5b2fc9)',
  medico:         'linear-gradient(135deg, #14b8a6, #0d9488)',
  administrativo: 'linear-gradient(135deg, #3b82f6, #2563eb)',
}

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  hideSidebarToggle?: boolean
  children?: ReactNode
}

export default function Header({ onToggleSidebar, sidebarOpen, hideSidebarToggle, children }: HeaderProps) {
  const { user, logout, activeTenant, switchTenant, isImpersonating, hasTela } = useAuth()
  const navigate = useNavigate()
  const [clinicDropdownOpen, setClinicDropdownOpen] = useState(false)
  const [userTenants, setUserTenants] = useState<{ id: number; nome: string; slug: string }[]>([])
  const clinicDropdownRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clinicDropdownRef.current && !clinicDropdownRef.current.contains(e.target as Node)) {
        setClinicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Carregar clínicas do usuário (via /auth/my-tenants)
  useEffect(() => {
    if (user) {
      api.get('/auth/my-tenants').then(res => setUserTenants(Array.isArray(res.data) ? res.data : [])).catch(() => {})
    }
  }, [user])

  const canSwitchTenant = userTenants.length > 1
  const originalTenantId = parseInt(localStorage.getItem('originalTenantId') || '0')

  const handleSwitchTenant = async (tenantId: number) => {
    try {
      await switchTenant(tenantId)
      setClinicDropdownOpen(false)
      window.location.reload()
    } catch {
      alert('Erro ao trocar de clínica')
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        {hideSidebarToggle && (
          <img src="/imagens/logo-escrita.png" alt="NordcsCare" className="header-logo" />
        )}
        {!hideSidebarToggle && (
          <Link to="/" className="header-home-btn" title="Menu principal">
            <LayoutGrid size={17} />
          </Link>
        )}
      </div>
      <div className="header-right" style={{display:'flex',alignItems:'center',gap:10}}>
        {canSwitchTenant && (
          <div className="school-dropdown" ref={clinicDropdownRef}>
            <button
              className={`school-dropdown-trigger ${isImpersonating ? 'has-school' : ''}`}
              onClick={() => setClinicDropdownOpen(!clinicDropdownOpen)}
              style={isImpersonating ? { borderColor: '#ed8936', background: 'rgba(237,137,54,0.08)' } : {}}
            >
              <Building2 size={15} className="school-dropdown-icon" />
              <span className="school-dropdown-label">
                {activeTenant ? activeTenant.nome : (userTenants.find(t => t.id === user?.tenant_id)?.nome || 'Minha Clínica')}
              </span>
              <ChevronDown size={14} className={`school-dropdown-chevron ${clinicDropdownOpen ? 'open' : ''}`} />
            </button>

            {clinicDropdownOpen && (
              <div className="school-dropdown-menu">
                <div className="school-dropdown-header">Alternar clínica</div>
                {userTenants.map(c => (
                  <button
                    key={c.id}
                    className={`school-dropdown-item ${(user?.tenant_id === c.id) ? 'active' : ''}`}
                    onClick={() => handleSwitchTenant(c.id)}
                  >
                    <Building2 size={16} />
                    <span>{c.nome}</span>
                  </button>
                ))}
                {isImpersonating && (
                  <div className="school-dropdown-footer">
                    <button className="school-dropdown-clear" onClick={() => handleSwitchTenant(originalTenantId)}>
                      <X size={13} /> Voltar à clínica original
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {user && (
          <Link to="/perfil" className="header-user-chip" title="Meu perfil">
            <div
              className="header-avatar"
              style={user.foto_perfil ? {} : { background: roleColors[user.role] ?? 'linear-gradient(135deg, #7345d6, #5b2fc9)' }}
            >
              {user.foto_perfil ? (
                <img src={`${(import.meta.env.VITE_API_BASE ?? '').replace('/api', '')}${user.foto_perfil}`} alt="avatar" className="header-avatar-img" />
              ) : (
                (user.nome_social || user.nome).split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
              )}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{(user.nome_social || user.nome).split(' ')[0]}</span>
            </div>
          </Link>
        )}

        {children}

        <button className="btn-logout" onClick={handleLogout} title="Sair do sistema">
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </div>
    </header>
  )
}

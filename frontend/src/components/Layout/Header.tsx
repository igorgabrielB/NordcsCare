import { useAuth } from '../../contexts/AuthContext.tsx'
import { useNavigate, Link } from 'react-router-dom'
import { Settings, Menu } from 'lucide-react'

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Médico',
  administrativo: 'Administrativo',
}

import { ReactNode } from 'react';
interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  children?: ReactNode
}

export default function Header({ onToggleSidebar, sidebarOpen, children }: HeaderProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className={`btn-toggle-sidebar ${sidebarOpen ? 'open' : ''}`} onClick={onToggleSidebar} title={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}>
          <Menu size={20} />
        </button>
        <h2>Nordcs Care</h2>
      </div>
      <div className="header-right" style={{display:'flex',alignItems:'center',gap:12}}>
        {user?.role === 'admin' && (
          <Link to="/admin" className="header-icon-link" title="Administração">
            <Settings size={16} />
          </Link>
        )}
        {user && (
          <div className="header-user">
            <span className="header-user-name">{user.nome}</span>
            <span className="header-user-role">{roleLabels[user.role] || user.role}</span>
          </div>
        )}
        {children}
        <button className="btn-logout" onClick={handleLogout}>
          Sair
        </button>
      </div>
    </header>
  )
}

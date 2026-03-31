import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, Home, Users, ClipboardList, BarChart2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext.tsx'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <Link to={isAdmin ? '/dashboard' : '/home'} className="sidebar-logo-container">
        <img src="/imagens/icon_pag.png" alt="NordcsCare" className={`sidebar-logo-icon ${isOpen ? 'hide' : ''}`} />
        <img src="/imagens/logo-escrita.png" alt="NordcsCare" className={`sidebar-logo-full ${isOpen ? 'show' : ''}`} />
      </Link>
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className={`sidebar-section-title ${isOpen ? 'show' : ''}`}>Principal</div>
          {isAdmin && (
            <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Dashboard">
              <span className="icon"><LayoutDashboard size={18} /></span>
              <span className={`sidebar-text ${isOpen ? 'show' : ''}`}>Dashboard</span>
            </NavLink>
          )}
          {!isAdmin && (
            <NavLink to="/home" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Início">
              <span className="icon"><Home size={18} /></span>
              <span className={`sidebar-text ${isOpen ? 'show' : ''}`}>Início</span>
            </NavLink>
          )}
          <NavLink to="/pacientes" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Pacientes">
            <span className="icon"><Users size={18} /></span>
            <span className={`sidebar-text ${isOpen ? 'show' : ''}`}>Pacientes</span>
          </NavLink>
          <NavLink to="/fila" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Fila de Atendimento">
            <span className="icon"><ClipboardList size={18} /></span>
            <span className={`sidebar-text ${isOpen ? 'show' : ''}`}>Fila de Atendimento</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/relatorios" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Relatórios">
              <span className="icon"><BarChart2 size={18} /></span>
              <span className={`sidebar-text ${isOpen ? 'show' : ''}`}>Relatórios</span>
            </NavLink>
          )}
        </div>
      </nav>
    </aside>
  )
}

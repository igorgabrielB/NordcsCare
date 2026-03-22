import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, ClipboardList, BarChart2 } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          {isOpen && <div className="sidebar-section-title">Principal</div>}
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Dashboard">
            <span className="icon"><LayoutDashboard size={18} /></span>
            {isOpen && <span>Dashboard</span>}
          </NavLink>
          <NavLink to="/pacientes" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Pacientes">
            <span className="icon"><Users size={18} /></span>
            {isOpen && <span>Pacientes</span>}
          </NavLink>
          <NavLink to="/fila" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Fila de Atendimento">
            <span className="icon"><ClipboardList size={18} /></span>
            {isOpen && <span>Fila de Atendimento</span>}
          </NavLink>
          <NavLink to="/relatorios" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Relatórios">
            <span className="icon"><BarChart2 size={18} /></span>
            {isOpen && <span>Relatórios</span>}
          </NavLink>
        </div>
      </nav>
    </aside>
  )
}

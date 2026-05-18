import { NavLink, Link } from 'react-router-dom'
import { ListChecks, Users, BarChart2, FileText, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext.tsx'

const NAV_ITEMS = [
  { to: '/fila',       icon: ListChecks, label: 'Fila de Atendimento', tela: 'fila'       },
  { to: '/pacientes',  icon: Users,      label: 'Pacientes',           tela: 'pacientes'  },
  { to: '/dashboard',  icon: BarChart2,  label: 'Dashboard',           tela: 'dashboard'  },
  { to: '/relatorios', icon: FileText,   label: 'Relatórios',          tela: 'relatorios' },
  { to: '/admin',      icon: Settings,   label: 'Administração',       tela: 'admin'      },
]

export default function Sidebar() {
  const { hasTela } = useAuth()

  return (
    <aside className="sidebar closed">
      <Link to="/menu" className="sidebar-logo-container">
        <img src="/imagens/icon_pag.png" alt="NordcsCare" className="sidebar-logo-icon" />
      </Link>
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          {NAV_ITEMS.filter(item => hasTela(item.tela)).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon"><item.icon size={18} /></span>
              <span className="sidebar-tooltip">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  )
}

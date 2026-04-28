import { NavLink, Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function Sidebar() {
  return (
    <aside className="sidebar closed">
      <Link to="/menu" className="sidebar-logo-container">
        <img src="/imagens/icon_pag.png" alt="NordcsCare" className="sidebar-logo-icon" />
      </Link>
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <NavLink to="/menu" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} title="Menu">
            <span className="icon"><Home size={18} /></span>
          </NavLink>
        </div>
      </nav>
    </aside>
  )
}

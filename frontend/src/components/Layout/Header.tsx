import { useAuth } from '../../contexts/AuthContext.tsx'
import { useSchool } from '../../contexts/SchoolContext.tsx'
import { useNavigate, Link } from 'react-router-dom'
import { Settings, Menu, School, ChevronDown, X, Building2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Médico',
  administrativo: 'Administrativo',
}

import type { ReactNode } from 'react';
interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  children?: ReactNode
}

export default function Header({ onToggleSidebar, sidebarOpen, children }: HeaderProps) {
  const { user, logout } = useAuth()
  const { selectedSchool, setSelectedSchool, escolasHoje } = useSchool()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const schools = Array.isArray(escolasHoje) ? escolasHoje : []

  return (
    <header className="header">
      <div className="header-left">
        <button className={`btn-toggle-sidebar ${sidebarOpen ? 'open' : ''}`} onClick={onToggleSidebar} title={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}>
          <Menu size={20} />
        </button>
      </div>
      <div className="header-right" style={{display:'flex',alignItems:'center',gap:12}}>
        {user?.role === 'admin' ? (
        <div className="school-dropdown" ref={dropdownRef}>
          <button
            className={`school-dropdown-trigger ${selectedSchool ? 'has-school' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <School size={15} className="school-dropdown-icon" />
            <span className="school-dropdown-label">
              {selectedSchool || 'Todas as escolas'}
            </span>
            <ChevronDown size={14} className={`school-dropdown-chevron ${dropdownOpen ? 'open' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="school-dropdown-menu">
              <div className="school-dropdown-header">Selecionar local</div>
              <button
                className={`school-dropdown-item ${!selectedSchool ? 'active' : ''}`}
                onClick={() => { setSelectedSchool(null); setDropdownOpen(false) }}
              >
                <Building2 size={16} />
                <span>Todas as escolas</span>
              </button>
              {schools.length > 0 && (
                <>
                  <div className="school-dropdown-divider" />
                  <div className="school-dropdown-section">Agendadas hoje</div>
                  {schools.map(e => (
                    <button
                      key={e.escola}
                      className={`school-dropdown-item ${selectedSchool === e.escola ? 'active' : ''}`}
                      onClick={() => { setSelectedSchool(e.escola); setDropdownOpen(false) }}
                    >
                      <School size={16} />
                      <span>{e.escola}</span>
                      <span className="school-dropdown-badge">{e.total_alunos}</span>
                    </button>
                  ))}
                </>
              )}
              {selectedSchool && (
                <div className="school-dropdown-footer">
                  <button className="school-dropdown-clear" onClick={() => { setSelectedSchool(null); setDropdownOpen(false) }}>
                    <X size={13} /> Limpar seleção
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        ) : null}
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

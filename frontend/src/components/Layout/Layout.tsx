import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar.tsx'
import Header from './Header.tsx'
import ThemeSwitch from '../ThemeSwitch'
import Footer from './Footer.tsx'
import './Layout.css'

interface LayoutProps {
  allowedRoles?: string[]
}

export default function Layout({ allowedRoles }: LayoutProps) {
  const { isAuthenticated, user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [light, setLight] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (light) {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  }, [light]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} />
      <div className="layout-main" style={{ marginLeft: sidebarOpen ? 'var(--sidebar-width)' : '60px' }}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen}>
          <ThemeSwitch light={light} setLight={setLight} />
        </Header>
        <main className="layout-content">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}

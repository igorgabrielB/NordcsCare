import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar.tsx'
import Header from './Header.tsx'
import ThemeSwitch from '../ThemeSwitch'
import Footer from './Footer.tsx'
import './Layout.css'

export default function Layout() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const isMenuPage = location.pathname === '/menu'
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

  return (
    <div className="layout">
      {!isMenuPage && <Sidebar />}
      <div className="layout-main" style={{ marginLeft: isMenuPage ? '0' : '60px' }}>
        <Header onToggleSidebar={() => {}} sidebarOpen={false} hideSidebarToggle={isMenuPage}>
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

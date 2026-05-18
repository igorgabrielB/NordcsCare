import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar.tsx'
import Header from './Header.tsx'
import ThemeSwitch from '../ThemeSwitch'
import Footer from './Footer.tsx'
import api from '../../services/api.ts'
import './Layout.css'

export default function Layout() {
  const { isAuthenticated, user, updatePerfil } = useAuth()
  const location = useLocation()
  const isMenuPage = location.pathname === '/menu'
  const [light, setLight] = useState(() => {
    // Preferência do servidor tem prioridade; fallback para localStorage
    if (user?.tema) return user.tema === 'light';
    return localStorage.getItem('theme') === 'light';
  });
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (light) {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }

    // Não sincroniza no mount — apenas quando o usuário altera
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const tema = light ? 'light' : 'dark';
    updatePerfil({ tema });
    api.put('/perfil/tema', { tema }).catch(() => {/* falha silenciosa */});
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

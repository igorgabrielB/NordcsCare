import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import api from '../services/api.ts'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutos
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']

interface User {
  id: number
  nome: string
  login: string
  role: 'master' | 'admin' | 'medico' | 'administrativo'
  tenant_id: number
}

interface ActiveTenant {
  id: number
  nome: string
  slug: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, senha: string) => Promise<User>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  activeTenant: ActiveTenant | null
  switchTenant: (tenantId: number) => Promise<void>
  isImpersonating: boolean
  telas: string[]           // códigos das telas que o usuário pode acessar
  hasTela: (codigo: string) => boolean
  telasLoaded: boolean
  refreshTelas: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [activeTenant, setActiveTenant] = useState<ActiveTenant | null>(() => {
    const stored = localStorage.getItem('activeTenant');
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  })
  const [originalTenantId] = useState<number | null>(() => {
    const stored = localStorage.getItem('originalTenantId');
    return stored ? parseInt(stored) : null;
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [telas, setTelas] = useState<string[]>(() => {
    const stored = localStorage.getItem('telas');
    if (!stored) return [];
    try { return JSON.parse(stored); } catch { return []; }
  })
  const [telasLoaded, setTelasLoaded] = useState(false)
  const isAuthenticated = !!token && !!user
  const isImpersonating = activeTenant !== null && originalTenantId !== null && activeTenant.id !== originalTenantId
  const isAdmin = telas.includes('admin')
  const hasTela = (codigo: string) => telas.includes(codigo)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setActiveTenant(null)
    setTelas([])
    setTelasLoaded(false)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('telas')
    localStorage.removeItem('activeTenant')
    localStorage.removeItem('originalTenantId')
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      logout()
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }, INACTIVITY_TIMEOUT)
  }, [logout])

  // Inactivity tracker
  useEffect(() => {
    if (!isAuthenticated) return

    const handleActivity = () => resetInactivityTimer()

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }))
    resetInactivityTimer()

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, resetInactivityTimer])

  useEffect(() => {
    if (token && !user) {
      api.get('/auth/me')
        .then((res) => {
          const userData: User = {
            id: res.data.id,
            nome: res.data.nome,
            login: res.data.login,
            role: res.data.role,
            tenant_id: res.data.tenant_id,
          }
          setUser(userData)
          localStorage.setItem('user', JSON.stringify(userData))
        })
        .catch(() => {
          setToken(null)
          setUser(null)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        })
    }
  }, [token, user])

  // Carrega as telas permitidas quando o usuário autentica
  useEffect(() => {
    if (!isAuthenticated) {
      setTelasLoaded(false)
      return
    }
    api.get('/permissoes/me')
      .then(res => {
        const lista: string[] = res.data.telas ?? []
        setTelas(lista)
        localStorage.setItem('telas', JSON.stringify(lista))
      })
      .catch(() => setTelas([]))
      .finally(() => setTelasLoaded(true))
  }, [isAuthenticated, activeTenant])

  const refreshTelas = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await api.get('/permissoes/me')
      const lista: string[] = res.data.telas ?? []
      setTelas(lista)
      localStorage.setItem('telas', JSON.stringify(lista))
    } catch { /* ignore */ }
  }, [isAuthenticated])

  const login = async (email: string, senha: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, senha })
    const { token: newToken, user: userData } = res.data
    setToken(newToken)
    setUser(userData)
    setActiveTenant(null)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('originalTenantId', String(userData.tenant_id))
    localStorage.removeItem('activeTenant')
    return userData
  }

  const switchTenant = async (tenantId: number): Promise<void> => {
    const res = await api.post('/auth/switch-tenant', { tenant_id: tenantId })
    const { token: newToken, tenant, user: userData } = res.data
    setToken(newToken)
    setUser(userData)
    setActiveTenant(tenant)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('activeTenant', JSON.stringify(tenant))
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isAdmin, activeTenant, switchTenant, isImpersonating, telas, hasTela, telasLoaded, refreshTelas }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

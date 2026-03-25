import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import api from '../services/api.ts'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutos
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']

interface User {
  id: number
  nome: string
  login: string
  role: 'admin' | 'medico' | 'administrativo'
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, senha: string) => Promise<User>
  logout: () => void
  isAuthenticated: boolean
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAuthenticated = !!token && !!user

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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

  const login = async (email: string, senha: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, senha })
    const { token: newToken, user: userData } = res.data
    setToken(newToken)
    setUser(userData)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    return userData
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
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

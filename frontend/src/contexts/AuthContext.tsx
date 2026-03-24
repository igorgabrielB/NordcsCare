import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '../services/api.ts'

interface User {
  id: number
  nome: string
  login: string
  role: 'admin' | 'medico' | 'administrativo'
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (loginName: string, senha: string) => Promise<User>
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

  const login = async (loginName: string, senha: string): Promise<User> => {
    const res = await api.post('/auth/login', { login: loginName, senha })
    const { token: newToken, user: userData } = res.data
    setToken(newToken)
    setUser(userData)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    return userData
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token && !!user }}>
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

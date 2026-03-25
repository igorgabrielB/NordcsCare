import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { User, Lock, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'
import './Login.css'

function getHomeRoute(role?: string) {
  if (role === 'medico' || role === 'administrativo') return '/home'
  return '/dashboard'
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [loginName, setLoginName] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const loggedUser = await login(loginName, senha)
      navigate(getHomeRoute(loggedUser?.role))
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Erro ao realizar login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Decorative side panel */}
      <div className="login-side">
        <div className="login-side-content">
          <div className="login-side-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src="/imagens/logo-login.png" alt="NordcsCare" style={{ height: '60px' }} />
          </div>
          <p className="login-side-subtitle">Prontuário Oftalmológico</p>
          <div className="login-side-decoration">
            <div className="decoration-ring ring-1" />
            <div className="decoration-ring ring-2" />
            <div className="decoration-ring ring-3" />
          </div>
        </div>
        <p className="login-side-footer">Sistema de Gestão em Saúde Ocular</p>
      </div>

      {/* Login form */}
      <div className="login-form-side">
        <div className="login-card">
          <div className="login-header">
            <h1>Bem-vindo</h1>
            <p>Faça login para acessar o sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login">Login</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="login"
                  type="text"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="Digite seu usuário"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? (
                <span className="btn-login-loading">
                  <span className="spinner" />
                  Entrando...
                </span>
              ) : (
                <span className="btn-login-content">
                  <LogIn size={18} />
                  Entrar
                </span>
              )}
            </button>
          </form>

          <p className="login-footer-text">NordcsCare &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}

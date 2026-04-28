import { useState, useRef, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { Lock, LogIn, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react'
import './Login.css'

function getHomeRoute(_role?: string) {
  return '/menu'
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const choosingSchoolRef = useRef(false)

  if (isAuthenticated && !choosingSchoolRef.current) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, senha)
      navigate(getHomeRoute())
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
            <div className="decoration-orb orb-1" />
            <div className="decoration-orb orb-2" />
            <div className="decoration-orb orb-3" />
          </div>
        </div>
        <p className="login-side-footer">Sistema de Gestão em Saúde Ocular</p>
      </div>

      {/* Login form */}
      <div className="login-form-side">
        <div className="login-card">
          <div className="login-header">
            <div className="login-header-icon">
              <Lock size={20} />
            </div>
            <h1>Bem-vindo de volta</h1>
            <p>Entre com suas credenciais para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
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
                  placeholder="••••••••"
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
                  Entrar no sistema
                </span>
              )}
            </button>
          </form>

          <div className="login-divider"><span>NordcsCare</span></div>
          <p className="login-footer-text">&copy; {new Date().getFullYear()} — Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  )
}

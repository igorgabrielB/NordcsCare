import { useState, useRef, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { useSchool } from '../../contexts/SchoolContext.tsx'
import api from '../../services/api.ts'
import { Lock, LogIn, Eye, EyeOff, AlertCircle, Mail, School, Building2, ArrowRight, CalendarDays } from 'lucide-react'
import './Login.css'

interface EscolaOption {
  escola: string
  total_alunos: number
}

function getHomeRoute(role?: string) {
  if (role === 'medico' || role === 'administrativo') return '/home'
  return '/dashboard'
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const { setSelectedSchool } = useSchool()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // School selection step
  const [step, setStep] = useState<'login' | 'escola'>('login')
  const [escolas, setEscolas] = useState<EscolaOption[]>([])
  const [loadingEscolas, setLoadingEscolas] = useState(false)
  const [loggedRole, setLoggedRole] = useState<string | undefined>()
  const choosingSchoolRef = useRef(false)

  if (isAuthenticated && step === 'login' && !choosingSchoolRef.current) {
    return <Navigate to={getHomeRoute(user?.role)} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    choosingSchoolRef.current = true

    try {
      const loggedUser = await login(email, senha)
      setLoggedRole(loggedUser?.role)
      setStep('escola')
      // Fetch today's schools after login
      setLoadingEscolas(true)
      try {
        const res = await api.get('/escola-agenda/hoje')
        const data = Array.isArray(res.data) ? res.data : []
        setEscolas(data)
      } catch {
        setEscolas([])
      } finally {
        setLoadingEscolas(false)
      }
    } catch (err: unknown) {
      choosingSchoolRef.current = false
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Erro ao realizar login')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSchool = (escola: string | null) => {
    setSelectedSchool(escola)
    choosingSchoolRef.current = false
    navigate(getHomeRoute(loggedRole))
  }

  if (step === 'escola') {
    return (
      <div className="login-page">
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

        <div className="login-form-side">
          <div className="login-card escola-step">
            <div className="escola-step-header">
              <div className="escola-step-icon-wrap">
                <School size={24} />
              </div>
              <h1>Selecionar Local</h1>
              <p>Escolha a escola ou clínica que você vai atender hoje</p>
            </div>

            {loadingEscolas ? (
              <div className="escola-loading">
                <div className="escola-loading-spinner" />
                <span>Buscando escolas agendadas...</span>
              </div>
            ) : (
              <>
                {loggedRole === 'admin' && (
                  <button
                    className="escola-option escola-option-all"
                    onClick={() => handleSelectSchool(null)}
                  >
                    <div className="escola-option-icon">
                      <Building2 size={20} />
                    </div>
                    <div className="escola-option-info">
                      <span className="escola-option-name">Todas as escolas</span>
                      <span className="escola-option-desc">Visão geral de todos os locais</span>
                    </div>
                    <ArrowRight size={16} className="escola-option-arrow" />
                  </button>
                )}

                {escolas.length > 0 && (
                  <div className="escola-list-section">
                    <div className="escola-list-label">
                      <CalendarDays size={13} />
                      <span>Agendadas para hoje</span>
                      <span className="escola-list-count">{escolas.length}</span>
                    </div>
                    <div className="escola-list">
                      {escolas.map((e, i) => (
                        <button
                          key={e.escola}
                          className="escola-option"
                          onClick={() => handleSelectSchool(e.escola)}
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div className="escola-option-icon">
                            <School size={20} />
                          </div>
                          <div className="escola-option-info">
                            <span className="escola-option-name">{e.escola}</span>
                            <span className="escola-option-desc">{e.total_alunos} aluno{e.total_alunos !== 1 ? 's' : ''} matriculado{e.total_alunos !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="escola-option-badge">{e.total_alunos}</div>
                          <ArrowRight size={16} className="escola-option-arrow" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {escolas.length === 0 && (
                  <div className="escola-empty">
                    <CalendarDays size={32} />
                    <p>Nenhuma escola agendada para hoje</p>
                    <span>Verifique o calendário de agendamentos</span>
                  </div>
                )}
              </>
            )}

            <p className="login-footer-text">NordcsCare &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    )
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

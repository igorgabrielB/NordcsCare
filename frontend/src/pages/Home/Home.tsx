import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { useSchool } from '../../contexts/SchoolContext.tsx'
import api from '../../services/api.ts'
import {
  Users,
  ClipboardList,
  FileText,
  Activity,
  Clock,
  ArrowRight,
  Stethoscope,
  TrendingUp,
  Calendar,
  School,
} from 'lucide-react'
import './Home.css'

interface FilaItem {
  id: number
  paciente_id: number
  nome_completo: string
  estacao: string
  status: string
  updated_at: string
}

interface Metricas {
  pacientes_do_dia: number
  atendimentos_hoje: number
  total_laudos: number
}

export default function Home() {
  const { user } = useAuth()
  const { selectedSchool } = useSchool()
  const navigate = useNavigate()
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [ultimosAtendidos, setUltimosAtendidos] = useState<FilaItem[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [selectedSchool])

  async function loadData() {
    try {
      const metricasParams: Record<string, string | number> = { data_inicio: hoje, data_fim: hoje }
      if (user?.role === 'medico') metricasParams.medico_id = user.id
      if (selectedSchool) metricasParams.escola = selectedSchool

      const filaParams: Record<string, string> = {}
      if (selectedSchool) filaParams.escola = selectedSchool

      const [metricasRes, filaRes] = await Promise.all([
        api.get('/dashboard/metricas', { params: metricasParams }),
        api.get('/fila', { params: filaParams }),
      ])

      setMetricas(metricasRes.data)

      const todasEstacoes: FilaItem[] = Object.values(filaRes.data as Record<string, FilaItem[]>).flat()
      const concluidos = todasEstacoes
        .filter((item) => item.status === 'concluido')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)

      setUltimosAtendidos(concluidos)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const estacaoLabel: Record<string, string> = {
    acuidade: 'Acuidade',
    exames: 'Exames',
    laudos: 'Laudos',
    oculos: 'Óculos',
    altas: 'Altas',
    encaminhamentos: 'Encaminhamentos',
  }

  const primeiroNome = user?.nome?.split(' ')[0]
  const nomeExibicao = user?.role === 'medico' ? `Dr(a). ${primeiroNome}` : primeiroNome

  return (
    <div className="home-page">
      {/* Hero welcome banner */}
      <div className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-content">
          <div className="home-hero-left">
            <div className="home-hero-text">
              <p className="home-hero-greeting">{saudacao},</p>
              <h1 className="home-hero-name">{nomeExibicao}!</h1>
            </div>
          </div>
          <div className="home-hero-right">
            {selectedSchool ? (
              <div className="home-escola-ativa">
                <span className="home-escola-dot" />
                <School size={14} />
                <span>{selectedSchool}</span>
              </div>
            ) : user?.role === 'admin' ? (
              <div className="home-escola-todas">
                <School size={14} />
                <span>Todas as escolas</span>
              </div>
            ) : null}
            <div className="home-hero-date">
              <Calendar size={15} />
              <span>
                {new Date().toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="home-loading">
          <div className="home-spinner" />
          <p>Carregando informações...</p>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="home-stats">
            <div className="home-stat-card stat-purple">
              <div className="home-stat-top">
                <div className="home-stat-icon">
                  <Users size={20} />
                </div>
                <TrendingUp size={14} className="home-stat-trend" />
              </div>
              <span className="home-stat-value">{metricas?.pacientes_do_dia ?? 0}</span>
              <span className="home-stat-label">Alunos agendados</span>
            </div>

            <div className="home-stat-card stat-green">
              <div className="home-stat-top">
                <div className="home-stat-icon">
                  <Stethoscope size={20} />
                </div>
                <TrendingUp size={14} className="home-stat-trend" />
              </div>
              <span className="home-stat-value">{metricas?.atendimentos_hoje ?? 0}</span>
              <span className="home-stat-label">Atendimentos</span>
            </div>

            <div className="home-stat-card stat-amber">
              <div className="home-stat-top">
                <div className="home-stat-icon">
                  <FileText size={20} />
                </div>
                <TrendingUp size={14} className="home-stat-trend" />
              </div>
              <span className="home-stat-value">{metricas?.total_laudos ?? 0}</span>
              <span className="home-stat-label">Laudos emitidos</span>
            </div>
          </div>

          {/* Two-column bottom section */}
          <div className="home-bottom">
            {/* Shortcuts */}
            <div className="home-card">
              <div className="home-card-header">
                <h2><ArrowRight size={16} /> Acesso rápido</h2>
              </div>
              <div className="home-shortcuts">
                <button className="home-shortcut" onClick={() => navigate('/fila')}>
                  <div className="shortcut-icon sc-purple"><ClipboardList size={20} /></div>
                  <div className="shortcut-text">
                    <span className="shortcut-title">Fila de Atendimento</span>
                    <span className="shortcut-desc">Gerenciar fila do dia</span>
                  </div>
                  <ArrowRight size={16} className="shortcut-arrow" />
                </button>
                <button className="home-shortcut" onClick={() => navigate('/pacientes')}>
                  <div className="shortcut-icon sc-blue"><Users size={20} /></div>
                  <div className="shortcut-text">
                    <span className="shortcut-title">Pacientes</span>
                    <span className="shortcut-desc">Buscar e visualizar</span>
                  </div>
                  <ArrowRight size={16} className="shortcut-arrow" />
                </button>
              </div>
            </div>

            {/* Recent patients */}
            <div className="home-card">
              <div className="home-card-header">
                <h2><Clock size={16} /> Últimos atendidos</h2>
              </div>
              {ultimosAtendidos.length === 0 ? (
                <div className="home-empty">
                  <Activity size={36} />
                  <p>Nenhum atendimento concluído hoje</p>
                </div>
            ) : (
              <div className="home-recent-list">
                {ultimosAtendidos.map((item) => (
                  <div
                    key={item.id}
                    className="home-recent-item"
                    onClick={() => navigate(`/prontuario/${item.paciente_id}`)}
                  >
                    <div className="home-recent-avatar">{item.nome_completo.charAt(0)}</div>
                    <div className="home-recent-info">
                      <span className="home-recent-name">{item.nome_completo}</span>
                      <span className="home-recent-station">
                        {estacaoLabel[item.estacao] || item.estacao}
                      </span>
                    </div>
                    <span className="home-recent-time">
                      {new Date(item.updated_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

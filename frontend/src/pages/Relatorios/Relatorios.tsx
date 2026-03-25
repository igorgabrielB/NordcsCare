import { Link } from 'react-router-dom'
import { BarChart3, FileBarChart, PieChart, TrendingUp, Clock, Wrench, Layers, FileSpreadsheet, Download, ArrowRight } from 'lucide-react'
import './Relatorios.css'

const AVAILABLE_REPORTS = [
  { icon: <FileBarChart size={20} />, title: 'Relatório de Atendimentos', desc: 'Histórico de atendimentos por período, escola, médico e resultado', link: '/relatorios/atendimentos', ready: true },
]

const PLANNED_FEATURES = [
  { icon: <PieChart size={20} />, title: 'Distribuição por Escola', desc: 'Visão geral dos alunos atendidos por escola' },
  { icon: <TrendingUp size={20} />, title: 'Evolução Mensal', desc: 'Gráficos de evolução de consultas e laudos ao longo do tempo' },
  { icon: <BarChart3 size={20} />, title: 'Exportação de Dados', desc: 'Exporte relatórios em PDF e Excel para análises externas' },
]

export default function Relatorios() {
  return (
    <div className="relatorios-page">
      {/* Hero */}
      <div className="rel-hero">
        <div className="rel-hero-bg-deco" />
        <div className="rel-hero-content">
          <div className="rel-hero-icon">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1>Relatórios</h1>
            <p className="rel-hero-subtitle">Análises e métricas do sistema</p>
          </div>
        </div>
        <div className="rel-hero-stats">
          <div className="rel-hero-stat">
            <div className="rel-hero-stat-icon rel-hsi-modulos">
              <Layers size={16} />
            </div>
            <div className="rel-hero-stat-info">
              <span className="rel-hero-stat-value">4</span>
              <span className="rel-hero-stat-label">Módulos Planejados</span>
            </div>
          </div>
          <div className="rel-hero-stat">
            <div className="rel-hero-stat-icon rel-hsi-formatos">
              <FileSpreadsheet size={16} />
            </div>
            <div className="rel-hero-stat-info">
              <span className="rel-hero-stat-value">2</span>
              <span className="rel-hero-stat-label">Formatos de Export</span>
            </div>
          </div>
          <div className="rel-hero-stat">
            <div className="rel-hero-stat-icon rel-hsi-download">
              <Download size={16} />
            </div>
            <div className="rel-hero-stat-info">
              <span className="rel-hero-stat-value">PDF</span>
              <span className="rel-hero-stat-label">&amp; Excel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Available Reports */}
      <div className="rel-available">
        <h3 className="rel-section-title">Disponíveis</h3>
        <div className="rel-available-grid">
          {AVAILABLE_REPORTS.map((r, i) => (
            <Link key={i} to={r.link} className="rel-report-card">
              <div className="rel-report-icon-ready">{r.icon}</div>
              <div className="rel-report-info">
                <h4>{r.title}</h4>
                <p>{r.desc}</p>
              </div>
              <ArrowRight size={18} className="rel-report-arrow" />
            </Link>
          ))}
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="rel-coming-soon">
        <div className="rel-cs-visual">
          <div className="rel-cs-ring rel-cs-ring-1" />
          <div className="rel-cs-ring rel-cs-ring-2" />
          <div className="rel-cs-ring rel-cs-ring-3" />
          <div className="rel-cs-icon-wrap">
            <Wrench size={32} />
          </div>
        </div>

        <div className="rel-cs-badge">
          <Clock size={14} />
          <span>Em Construção</span>
        </div>

        <h2>Mais relatórios em breve</h2>
        <p className="rel-cs-desc">
          Novos módulos de relatórios estão sendo desenvolvidos para oferecer
          insights completos sobre os atendimentos e operações do sistema.
        </p>

        {/* Progress bar */}
        <div className="rel-cs-progress">
          <div className="rel-cs-progress-label">
            <span>Progresso do desenvolvimento</span>
            <span className="rel-cs-progress-pct">35%</span>
          </div>
          <div className="rel-cs-progress-bar">
            <div className="rel-cs-progress-fill" />
          </div>
        </div>
      </div>

      {/* Planned features */}
      <div className="rel-features">
        <h3 className="rel-features-title">Funcionalidades Planejadas</h3>
        <div className="rel-features-grid">
          {PLANNED_FEATURES.map((f, i) => (
            <div key={i} className="rel-feature-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="rel-feature-icon">{f.icon}</div>
              <div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

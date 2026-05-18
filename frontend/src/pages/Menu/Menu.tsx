import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import {
  ListChecks, Users, ClipboardList, BarChart2, FileText,
  CalendarDays, GraduationCap, Upload, Trash2, Stethoscope,
  BookOpen, FileEdit, UserCog, ScrollText, Settings,
  LayoutTemplate, ShieldCheck, Hospital, Eye,
  Search, Sheet, X, ArrowRight,
  Activity, BookMarked, Layers, MonitorPlay,
  Sun, Sunset, Moon, Sparkles, Bell,
} from 'lucide-react'
import './Menu.css'

interface TelaItem {
  codigo: string
  nome: string
  descricao: string
  icone: string
  categoria: string
  rota: string
}

const ICON_MAP: Record<string, React.ElementType> = {
  ListChecks, Users, ClipboardList, BarChart2, FileText,
  CalendarDays, GraduationCap, Upload, Trash2, Stethoscope,
  BookOpen, FileEdit, UserCog, ScrollText, Settings,
  LayoutTemplate, ShieldCheck, Hospital, Eye, Sheet, MonitorPlay, Bell,
}

const CATEGORIAS: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  operacional: { label: 'Operacional',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   icon: Activity },
  gestao:      { label: 'Gestão',       color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   icon: BarChart2 },
  academico:   { label: 'Acadêmico',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   icon: BookMarked },
  clinico:     { label: 'Clínico',      color: '#14b8a6', bg: 'rgba(20,184,166,0.1)',   icon: Stethoscope },
  sistema:     { label: 'Sistema',      color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   icon: Layers },
  geral:       { label: 'Geral',        color: '#64748b', bg: 'rgba(100,116,139,0.1)',  icon: Settings },
}

const CATEGORIA_ORDER = ['operacional', 'gestao', 'academico', 'clinico', 'sistema', 'geral']

// Telas que aparecem na tela de Administração — não devem aparecer no Menu
const ADMIN_TELAS = new Set([
  'usuarios', 'perfis', 'medicos', 'alunos', 'import_escola', 'exclusao_escola',
  'clinicas', 'agenda_escola', 'modelos_docs', 'laudos_prontos', 'spotvision',
  'logs', 'dashboard_builder', 'prontuario',
])

const ALL_TELAS: TelaItem[] = [
  { codigo: 'fila',                    nome: 'Fila de Atendimento',    descricao: 'Gerencia a fila de pacientes por estação',       icone: 'ListChecks',     categoria: 'operacional', rota: '/fila' },
  { codigo: 'painel_senha',            nome: 'Painel de Senha',        descricao: 'Display de chamada de pacientes',                 icone: 'MonitorPlay',    categoria: 'operacional', rota: '/painel' },
  { codigo: 'agendamentos',            nome: 'Agendamentos',           descricao: 'Agendar consultas, retornos e exames por especialidade', icone: 'CalendarDays', categoria: 'operacional', rota: '/agendamentos' },
  { codigo: 'pacientes',               nome: 'Pacientes',              descricao: 'Cadastro e edição de pacientes',                  icone: 'Users',          categoria: 'operacional', rota: '/pacientes' },
  { codigo: 'prontuario',              nome: 'Prontuário',             descricao: 'Atendimento clínico e prontuário',                icone: 'ClipboardList',  categoria: 'operacional', rota: '/pacientes' },
  { codigo: 'dashboard',               nome: 'Dashboard',              descricao: 'Métricas e indicadores em tempo real',            icone: 'BarChart2',      categoria: 'gestao',      rota: '/dashboard' },
  { codigo: 'relatorios',              nome: 'Relatórios',             descricao: 'Relatórios gerenciais',                           icone: 'FileText',       categoria: 'gestao',      rota: '/relatorios' },
  { codigo: 'relatorios_atendimentos', nome: 'Rel. Atendimentos',      descricao: 'Histórico de atendimentos exportável',            icone: 'Sheet',          categoria: 'gestao',      rota: '/relatorios/atendimentos' },
  { codigo: 'agenda_escola',           nome: 'Agenda Escolar',         descricao: 'Agendamento de visitas às escolas',               icone: 'CalendarDays',   categoria: 'academico',   rota: '/admin/agenda-escola' },
  { codigo: 'alunos',                  nome: 'Alunos',                 descricao: 'Importação e gestão de alunos',                   icone: 'GraduationCap',  categoria: 'academico',   rota: '/admin/alunos' },
  { codigo: 'import_escola',           nome: 'Importar Escola',        descricao: 'Importação de dados de escolas',                  icone: 'Upload',         categoria: 'academico',   rota: '/admin/import-escola' },
  { codigo: 'exclusao_escola',         nome: 'Exclusão de Escola',     descricao: 'Remove escola e seus dados',                      icone: 'Trash2',         categoria: 'academico',   rota: '/admin/exclusao-escola' },
  { codigo: 'medicos',                 nome: 'Médicos',                descricao: 'Cadastro de médicos',                             icone: 'Stethoscope',    categoria: 'clinico',     rota: '/admin/medicos' },
  { codigo: 'laudos_prontos',          nome: 'Laudos Prontos',         descricao: 'Biblioteca de laudos pré-definidos',              icone: 'BookOpen',       categoria: 'clinico',     rota: '/admin/laudos-prontos' },
  { codigo: 'modelos_docs',            nome: 'Modelos de Documentos',  descricao: 'Templates de documentos clínicos',                icone: 'FileEdit',       categoria: 'clinico',     rota: '/admin/modelos-documentos' },
  { codigo: 'usuarios',                nome: 'Usuários',               descricao: 'Cadastro e permissões de usuários',               icone: 'UserCog',        categoria: 'sistema',     rota: '/usuarios' },
  { codigo: 'logs',                    nome: 'Logs do Sistema',        descricao: 'Auditoria de ações no sistema',                   icone: 'ScrollText',     categoria: 'sistema',     rota: '/admin/logs' },
  { codigo: 'admin',                   nome: 'Configurações',          descricao: 'Configurações gerais da clínica',                 icone: 'Settings',       categoria: 'sistema',     rota: '/admin' },
  { codigo: 'dashboard_builder',       nome: 'Dashboard Builder',      descricao: 'Personalizar layout do dashboard',                icone: 'LayoutTemplate', categoria: 'sistema',     rota: '/admin/dashboard-builder' },
  { codigo: 'perfis',                  nome: 'Perfis de Acesso',       descricao: 'Gerenciamento de roles e permissões',             icone: 'ShieldCheck',    categoria: 'sistema',     rota: '/admin/perfis' },
  { codigo: 'clinicas',                nome: 'Clínicas',               descricao: 'Gerenciamento de clínicas (master)',               icone: 'Hospital',       categoria: 'sistema',     rota: '/admin/clinicas' },
  { codigo: 'spotvision',              nome: 'SpotVision Admin',       descricao: 'Configurações do módulo SpotVision',              icone: 'Eye',            categoria: 'sistema',     rota: '/admin/spotvision' },
]

export default function Menu() {
  const navigate = useNavigate()
  const { hasTela, user, refreshTelas } = useAuth()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Atualiza permissões ao entrar no Menu
  useEffect(() => { refreshTelas() }, [refreshTelas])

  const visibleTelas = useMemo(() =>
    ALL_TELAS.filter(t => (t.codigo === 'painel_senha' || hasTela(t.codigo)) && !ADMIN_TELAS.has(t.codigo)),
  [hasTela])

  const filtered = useMemo(() => {
    if (!query.trim()) return visibleTelas
    const q = query.toLowerCase()
    return visibleTelas.filter(t =>
      t.nome.toLowerCase().includes(q) ||
      t.descricao.toLowerCase().includes(q) ||
      CATEGORIAS[t.categoria]?.label.toLowerCase().includes(q)
    )
  }, [visibleTelas, query])

  const grouped = useMemo(() => {
    const map: Record<string, TelaItem[]> = {}
    for (const t of filtered) {
      if (!map[t.categoria]) map[t.categoria] = []
      map[t.categoria].push(t)
    }
    return map
  }, [filtered])

  const saudacao = (() => {
    const h = new Date().getHours()
    if (h < 12) return { texto: 'Bom dia', Icon: Sun, cor: '#f59e0b' }
    if (h < 18) return { texto: 'Boa tarde', Icon: Sunset, cor: '#f97316' }
    return { texto: 'Boa noite', Icon: Moon, cor: '#818cf8' }
  })()

  const roleLabel: Record<string, string> = {
    master: 'Master',
    admin: 'Administrador',
    medico: 'Médico',
    administrativo: 'Administrativo',
  }

  const nomeAbrev = (user?.nome_social || user?.nome)?.split(' ').slice(0, 2).join(' ') ?? ''

  const categoriasVisiveis = CATEGORIA_ORDER.filter(cat => grouped[cat]?.length)

  return (
    <div className="menu-page">

      {/* ── Hero ── */}
      <div className="menu-hero">
        <div className="menu-hero-left">
          <div className="menu-hero-greeting">
            <div className="menu-hero-icon" style={{ '--greeting-color': saudacao.cor } as React.CSSProperties}>
              <saudacao.Icon size={22} />
            </div>
            <div>
              <h1 className="menu-hero-title">
                {saudacao.texto}, <span className="menu-hero-name">{nomeAbrev}</span>
                <Sparkles size={18} className="menu-hero-sparkle" />
              </h1>
              <p className="menu-hero-subtitle">
                <span className="menu-hero-role">{roleLabel[user?.role ?? ''] ?? user?.role}</span>
                &nbsp;·&nbsp;
                {visibleTelas.length} módulo{visibleTelas.length !== 1 ? 's' : ''} disponíve{visibleTelas.length !== 1 ? 'is' : 'l'}
              </p>
            </div>
          </div>
        </div>

        {/* Category badges */}
        <div className="menu-cat-badges">
          {CATEGORIA_ORDER.filter(c => visibleTelas.some(t => t.categoria === c)).map(cat => {
            const info = CATEGORIAS[cat]
            const CatIcon = info.icon
            return (
              <span key={cat} className="menu-cat-badge" style={{ '--badge-color': info.color, '--badge-bg': info.bg } as React.CSSProperties}>
                <CatIcon size={11} />
                {info.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="menu-search-wrap">
        <Search size={16} className="menu-search-icon" />
        <input
          ref={searchRef}
          className="menu-search-input"
          type="text"
          placeholder="Buscar por nome, descrição ou categoria..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="menu-search-clear" onClick={() => { setQuery(''); searchRef.current?.focus() }}>
            <X size={14} />
          </button>
        )}
        {query && (
          <span className="menu-search-count">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Results ── */}
      {filtered.length === 0 ? (
        <div className="menu-empty">
          <Search size={36} strokeWidth={1.5} />
          <p>Nenhuma funcionalidade encontrada para "<strong>{query}</strong>"</p>
        </div>
      ) : (
        <div className="menu-body">
          {categoriasVisiveis.map(cat => {
            const info = CATEGORIAS[cat] ?? { label: cat, color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: Settings }
            const CatIcon = info.icon
            const items = grouped[cat]
            return (
              <section key={cat} className="menu-section" style={{ '--cat-color': info.color, '--cat-bg': info.bg } as React.CSSProperties}>
                {/* Section header */}
                <div className="menu-section-header">
                  <div className="menu-section-pill">
                    <CatIcon size={13} />
                    <span>{info.label}</span>
                  </div>
                  <div className="menu-section-line" />
                  <span className="menu-section-count">{items.length}</span>
                </div>

                {/* Cards grid */}
                <div className="menu-cards-grid">
                  {items.map(tela => {
                    const Icon = ICON_MAP[tela.icone] ?? Settings
                    return (
                      <button
                        key={tela.codigo}
                        className="menu-card"
                        onClick={() => tela.codigo === 'painel_senha' ? window.open('/#' + tela.rota, '_blank') : navigate(tela.rota)}
                        style={{ '--card-color': info.color, '--card-bg': info.bg } as React.CSSProperties}
                      >
                        <div className="menu-card-icon-wrap">
                          <Icon size={20} />
                        </div>
                        <div className="menu-card-content">
                          <span className="menu-card-name">{tela.nome}</span>
                          <span className="menu-card-desc">{tela.descricao}</span>
                        </div>
                        <ArrowRight size={14} className="menu-card-arrow" />
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

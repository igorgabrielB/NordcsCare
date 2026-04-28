import { Link } from 'react-router-dom'
import { Users, Stethoscope, GraduationCap, FileText, School, Trash2, CalendarDays, ClipboardList, BookOpen, ShieldCheck, Settings, ChevronRight, Eye, Building2 } from 'lucide-react'
import './Admin.css'

const adminSections = [
  {
    title: 'Gestão de Acesso',
    items: [
      {
        to: '/usuarios',
        label: 'Usuários',
        desc: 'Gerenciar logins e permissões do sistema',
        icon: <Users size={22} />,
        color: '#3182ce',
      },
      {
        to: '/admin/perfis',
        label: 'Perfis & Permissões',
        desc: 'Visualizar permissões e alterar perfil dos usuários',
        icon: <ShieldCheck size={22} />,
        color: '#805ad5',
      },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      {
        to: '/admin/medicos',
        label: 'Médicos',
        desc: 'Registrar médicos e seus CRMs',
        icon: <Stethoscope size={22} />,
        color: '#38a169',
      },
      {
        to: '/admin/alunos',
        label: 'Inclusão de Alunos',
        desc: 'Importar pacientes/alunos em lote via CSV',
        icon: <GraduationCap size={22} />,
        color: '#d69e2e',
      },
      {
        to: '/admin/import-escola',
        label: 'Importação por Escola',
        desc: 'Importar CSV separando alunos por escola',
        icon: <School size={22} />,
        color: '#c4956a',
      },
      {
        to: '/admin/exclusao-escola',
        label: 'Exclusão por Escola',
        desc: 'Remover alunos em lote por escola',
        icon: <Trash2 size={22} />,
        color: '#e53e3e',
      },
    ],
  },
  {
    title: 'Configurações',
    items: [
      {
        to: '/admin/clinicas',
        label: 'Clínicas',
        desc: 'Gerenciar clínicas e acessos multi-tenant',
        icon: <Building2 size={22} />,
        color: '#3182ce',
      },
      {
        to: '/admin/agenda-escola',
        label: 'Agenda de Escolas',
        desc: 'Definir dias de atendimento por escola',
        icon: <CalendarDays size={22} />,
        color: '#48bb78',
      },
      {
        to: '/admin/modelos-documentos',
        label: 'Modelos de Documentos',
        desc: 'Gerenciar modelos de atestados e receitas',
        icon: <ClipboardList size={22} />,
        color: '#ed8936',
      },
      {
        to: '/admin/laudos-prontos',
        label: 'Laudos Prontos',
        desc: 'Gerenciar diagnósticos pré-definidos para laudos',
        icon: <BookOpen size={22} />,
        color: '#805ad5',
      },
    ],
  },
  {
    title: 'Equipamentos',
    items: [
      {
        to: '/admin/spotvision',
        label: 'SpotVision',
        desc: 'Gerenciar exames do S3 e corrigir vinculação de pacientes',
        icon: <Eye size={22} />,
        color: '#38a169',
      },
    ],
  },
  {
    title: 'Monitoramento',
    items: [
      {
        to: '/admin/logs',
        label: 'Logs de Auditoria',
        desc: 'Histórico de ações na fila de atendimento',
        icon: <FileText size={22} />,
        color: '#3182ce',
      },
    ],
  },
]

export default function Admin() {
  return (
    <div className="admin-page">
      <div className="admin-hero">
        <div className="admin-hero-icon">
          <Settings size={28} />
        </div>
        <div>
          <h1>Administração</h1>
          <p>Gerencie usuários, médicos, alunos e visualize logs do sistema</p>
        </div>
      </div>

      {adminSections.map((section) => (
        <div key={section.title} className="admin-section">
          <h2 className="admin-section-title">{section.title}</h2>
          <div className="admin-grid">
            {section.items.map((opt) => (
              <Link key={opt.to} to={opt.to} className="admin-card">
                <div className="admin-card-left">
                  <div className="admin-card-icon" style={{ background: `${opt.color}18`, color: opt.color }}>
                    {opt.icon}
                  </div>
                  <div className="admin-card-text">
                    <span className="admin-card-label">{opt.label}</span>
                    <span className="admin-card-desc">{opt.desc}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="admin-card-arrow" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

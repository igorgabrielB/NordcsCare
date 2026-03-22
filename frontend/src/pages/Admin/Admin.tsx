import { Link } from 'react-router-dom'
import { Users, Stethoscope, GraduationCap, FileText, School, Trash2, CalendarDays } from 'lucide-react'
import './Admin.css'

const adminOptions = [
  {
    to: '/usuarios',
    label: 'Usuários',
    desc: 'Gerenciar logins e permissões do sistema',
    icon: <Users size={26} />,
    color: 'rgba(49,130,206,0.15)',
    iconColor: '#63b3ed',
  },
  {
    to: '/admin/medicos',
    label: 'Cadastro de Médicos',
    desc: 'Registrar médicos e seus CRMs',
    icon: <Stethoscope size={26} />,
    color: 'rgba(56,161,105,0.15)',
    iconColor: '#68d391',
  },
  {
    to: '/admin/logs',
    label: 'Logs de Fila',
    desc: 'Histórico de ações na fila de atendimento',
    icon: <FileText size={26} />,
    color: 'rgba(115,69,214,0.15)',
    iconColor: '#b794f4',
  },
  {
    to: '/admin/alunos',
    label: 'Inclusão de Alunos',
    desc: 'Importar pacientes/alunos em lote via CSV',
    icon: <GraduationCap size={26} />,
    color: 'rgba(214,158,46,0.15)',
    iconColor: '#ecc94b',
  },
  {
    to: '/admin/import-escola',
    label: 'Importação por Escola',
    desc: 'Importar CSV separando alunos por escola',
    icon: <School size={26} />,
    color: 'rgba(196,149,106,0.15)',
    iconColor: '#c4956a',
  },
  {
    to: '/admin/exclusao-escola',
    label: 'Exclusão por Escola',
    desc: 'Remover alunos em lote por escola',
    icon: <Trash2 size={26} />,
    color: 'rgba(245,101,101,0.15)',
    iconColor: '#fc8181',
  },
  {
    to: '/admin/agenda-escola',
    label: 'Agenda de Escolas',
    desc: 'Definir dias de atendimento por escola',
    icon: <CalendarDays size={26} />,
    color: 'rgba(56,161,105,0.15)',
    iconColor: '#48bb78',
  },
]

export default function Admin() {
  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Administração</h1>
        <p>Gerencie usuários, médicos, alunos e visualize logs do sistema</p>
      </div>

      <div className="admin-grid">
        {adminOptions.map((opt) => (
            <Link key={opt.to} to={opt.to} className="admin-card">
              <div className="admin-card-icon" style={{ background: opt.color, color: opt.iconColor }}>
                {opt.icon}
              </div>
              <span className="admin-card-label">{opt.label}</span>
              <span className="admin-card-desc">{opt.desc}</span>
            </Link>
        ))}
      </div>
    </div>
  )
}

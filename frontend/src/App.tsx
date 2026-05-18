import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { SchoolProvider } from './contexts/SchoolContext.tsx'
import { useEffect } from 'react'
import Layout from './components/Layout/Layout.tsx'
import PermissionRoute from './components/PermissionRoute/PermissionRoute.tsx'
import Login from './pages/Login/Login.tsx'
import Menu from './pages/Menu/Menu.tsx'
import Dashboard from './pages/Dashboard/Dashboard.tsx'
import PacientesList from './pages/Pacientes/PacientesList.tsx'
import PacienteForm from './pages/Pacientes/PacienteForm.tsx'
import FilaPage from './pages/Fila/Fila.tsx'
import Prontuario from './pages/Prontuario/Prontuario.tsx'
import Usuarios from './pages/Usuarios/Usuarios.tsx'
import Admin from './pages/Admin/Admin.tsx'
import Medicos from './pages/Medicos/Medicos.tsx'
import Logs from './pages/Logs/Logs.tsx'
import Alunos from './pages/Alunos/Alunos.tsx'
import ImportEscola from './pages/ImportEscola/ImportEscola.tsx'
import ExclusaoEscola from './pages/ExclusaoEscola/ExclusaoEscola.tsx'
import AgendaEscola from './pages/AgendaEscola/AgendaEscola.tsx'
import Relatorios from './pages/Relatorios/Relatorios.tsx'
import RelatorioAtendimentos from './pages/RelatorioAtendimentos/RelatorioAtendimentos.tsx'
import ModelosDocumentos from './pages/ModelosDocumentos/ModelosDocumentos.tsx'
import LaudosProntos from './pages/LaudosProntos/LaudosProntos.tsx'
import GerenciamentoRoles from './pages/GerenciamentoRoles/GerenciamentoRoles.tsx'
import SpotVisionAdmin from './pages/SpotVisionAdmin/SpotVisionAdmin.tsx'
import Clinicas from './pages/Clinicas/Clinicas.tsx'
import Especialidades from './pages/Especialidades/Especialidades.tsx'
import EspecialidadeConfigurar from './pages/Especialidades/EspecialidadeConfigurar.tsx'
import Agendamentos from './pages/Agendamentos/Agendamentos.tsx'
import Home from './pages/Home/Home.tsx'
import DashboardBuilder from './pages/DashboardBuilder/DashboardBuilder.tsx'
import PainelSenha from './pages/PainelSenha/PainelSenha.tsx'
import Perfil from './pages/Perfil/Perfil.tsx'

function AuthLogoutListener() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  useEffect(() => {
    const handler = () => {
      logout()
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [navigate, logout])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SchoolProvider>
          <AuthLogoutListener />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/painel" element={<PainelSenha />} />

          {/* Dashboard */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<PermissionRoute tela="dashboard"><Dashboard /></PermissionRoute>} />
          </Route>

          {/* Protected - all roles */}
          <Route element={<Layout />}>
            <Route path="/menu" element={<Menu />} />
            <Route path="/home" element={<Home />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/pacientes" element={<PermissionRoute tela="pacientes"><PacientesList /></PermissionRoute>} />
            <Route path="/pacientes/novo" element={<PermissionRoute tela="pacientes"><PacienteForm /></PermissionRoute>} />
            <Route path="/pacientes/:id/editar" element={<PermissionRoute tela="pacientes"><PacienteForm /></PermissionRoute>} />
            <Route path="/fila" element={<PermissionRoute tela="fila"><FilaPage /></PermissionRoute>} />
            <Route path="/prontuario/:pacienteId" element={<PermissionRoute tela="prontuario"><Prontuario /></PermissionRoute>} />
          </Route>

          {/* Rotas somente para admin */}
          <Route element={<Layout />}>
            <Route path="/relatorios" element={<PermissionRoute tela="relatorios"><Relatorios /></PermissionRoute>} />
            <Route path="/relatorios/atendimentos" element={<PermissionRoute tela="relatorios_atendimentos"><RelatorioAtendimentos /></PermissionRoute>} />
            <Route path="/usuarios" element={<PermissionRoute tela="usuarios"><Usuarios /></PermissionRoute>} />
            <Route path="/admin" element={<PermissionRoute tela="admin"><Admin /></PermissionRoute>} />
            <Route path="/admin/medicos" element={<PermissionRoute tela="medicos"><Medicos /></PermissionRoute>} />
            <Route path="/admin/logs" element={<PermissionRoute tela="logs"><Logs /></PermissionRoute>} />
            <Route path="/admin/alunos" element={<PermissionRoute tela="alunos"><Alunos /></PermissionRoute>} />
            <Route path="/admin/import-escola" element={<PermissionRoute tela="import_escola"><ImportEscola /></PermissionRoute>} />
            <Route path="/admin/exclusao-escola" element={<PermissionRoute tela="exclusao_escola"><ExclusaoEscola /></PermissionRoute>} />
            <Route path="/admin/agenda-escola" element={<PermissionRoute tela="agenda_escola"><AgendaEscola /></PermissionRoute>} />
            <Route path="/admin/modelos-documentos" element={<PermissionRoute tela="modelos_docs"><ModelosDocumentos /></PermissionRoute>} />
            <Route path="/admin/laudos-prontos" element={<PermissionRoute tela="laudos_prontos"><LaudosProntos /></PermissionRoute>} />
            <Route path="/admin/perfis" element={<PermissionRoute tela="perfis"><GerenciamentoRoles /></PermissionRoute>} />
            <Route path="/admin/spotvision" element={<PermissionRoute tela="spotvision"><SpotVisionAdmin /></PermissionRoute>} />
            <Route path="/admin/clinicas" element={<PermissionRoute tela="clinicas"><Clinicas /></PermissionRoute>} />
            <Route path="/admin/especialidades" element={<PermissionRoute tela="especialidades"><Especialidades /></PermissionRoute>} />
            <Route path="/admin/especialidades/:id/configurar" element={<PermissionRoute tela="especialidades"><EspecialidadeConfigurar /></PermissionRoute>} />
            <Route path="/agendamentos" element={<PermissionRoute tela="agendamentos"><Agendamentos /></PermissionRoute>} />
            <Route path="/admin/dashboard-builder" element={<PermissionRoute tela="dashboard_builder"><DashboardBuilder /></PermissionRoute>} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
          </SchoolProvider>
      </AuthProvider>
    </HashRouter>
  )
}

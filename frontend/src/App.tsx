import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { useEffect } from 'react'
import Layout from './components/Layout/Layout.tsx'
import Login from './pages/Login/Login.tsx'
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
import Home from './pages/Home/Home.tsx'

function AuthLogoutListener() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [navigate])
  return null
}

export default function App() {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthLogoutListener />
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Dashboard - somente admin */}
          <Route element={<Layout allowedRoles={['admin']} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Protected - all roles */}
          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/pacientes" element={<PacientesList />} />
            <Route path="/pacientes/novo" element={<PacienteForm />} />
            <Route path="/pacientes/:id/editar" element={<PacienteForm />} />
            <Route path="/fila" element={<FilaPage />} />
            <Route path="/prontuario/:pacienteId" element={<Prontuario />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/relatorios/atendimentos" element={<RelatorioAtendimentos />} />
          </Route>

          {/* Rotas somente para admin */}
          <Route element={<Layout allowedRoles={['admin']} />}>
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/medicos" element={<Medicos />} />
            <Route path="/admin/logs" element={<Logs />} />
            <Route path="/admin/alunos" element={<Alunos />} />
            <Route path="/admin/import-escola" element={<ImportEscola />} />
            <Route path="/admin/exclusao-escola" element={<ExclusaoEscola />} />
            <Route path="/admin/agenda-escola" element={<AgendaEscola />} />
            <Route path="/admin/modelos-documentos" element={<ModelosDocumentos />} />
            <Route path="/admin/laudos-prontos" element={<LaudosProntos />} />
            <Route path="/admin/perfis" element={<GerenciamentoRoles />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/fila" replace />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

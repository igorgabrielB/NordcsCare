import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.tsx'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected - all roles */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pacientes" element={<PacientesList />} />
            <Route path="/pacientes/novo" element={<PacienteForm />} />
            <Route path="/pacientes/:id/editar" element={<PacienteForm />} />
            <Route path="/fila" element={<FilaPage />} />
            <Route path="/prontuario/:pacienteId" element={<Prontuario />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/medicos" element={<Medicos />} />
            <Route path="/admin/logs" element={<Logs />} />
            <Route path="/admin/alunos" element={<Alunos />} />
            <Route path="/admin/import-escola" element={<ImportEscola />} />
            <Route path="/admin/exclusao-escola" element={<ExclusaoEscola />} />
            <Route path="/admin/agenda-escola" element={<AgendaEscola />} />
            <Route path="/relatorios" element={<Relatorios />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

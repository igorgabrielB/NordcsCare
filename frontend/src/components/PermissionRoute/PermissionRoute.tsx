import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'

interface PermissionRouteProps {
  tela: string
  children: React.ReactNode
}

/**
 * Protege uma rota pelo código da tela.
 * Admins têm acesso a tudo automaticamente.
 * Aguarda telasLoaded para não redirecionar prematuramente.
 */
export default function PermissionRoute({ tela, children }: PermissionRouteProps) {
  const { hasTela, telasLoaded, isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Aguarda o carregamento das permissões antes de bloquear
  if (!telasLoaded) return null

  if (!hasTela(tela)) return <Navigate to="/menu" replace />

  return <>{children}</>
}

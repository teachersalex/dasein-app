import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Post from './pages/Post'
import Feed from './pages/Feed'

// ✅ SAFE - pode ajustar tempos
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: true
    }
  }
})

// 🔒 Exige auth
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <div className="screen-center"><div className="spinner" /></div>
  }
  
  return user ? children : <Navigate to="/" replace />
}

// 🔒 Redireciona se já logado
function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()
  
  if (loading) {
    return <div className="screen-center"><div className="spinner" /></div>
  }
  
  // ⚠️ Checa user E profile (onboarding pode estar incompleto)
  return (user && profile) ? <Navigate to="/home" replace /> : children
}

// 🔒 Handler: getdasein.app/DSEIN-XXXXX
function InviteRoute() {
  const { inviteCode } = useParams()
  const { user, profile, loading } = useAuth()
  
  if (!loading && user && profile) {
    return <Navigate to="/home" replace />
  }
  
  // 🔒 Formato do convite - mudar quebra convites existentes
  const isValidFormat = /^DSEIN-[A-Z0-9]{5}$/i.test(inviteCode)
  
  if (isValidFormat) {
    return <Navigate to="/auth" state={{ inviteCode: inviteCode.toUpperCase() }} replace />
  }
  
  return <Navigate to="/" replace />
}

// 🔒 Ordem dos providers importa
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/auth" element={<Auth />} />
            
            {/* 🔒 Protegidas - mudar paths quebra links salvos */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/post/:id" element={<ProtectedRoute><Post /></ProtectedRoute>} />
            
            {/* Convites */}
            <Route path="/:inviteCode" element={<InviteRoute />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
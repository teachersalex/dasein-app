import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import BottomNav from './components/BottomNav'

import Landing from './pages/Landing'
import Camera from './pages/Camera'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Post from './pages/Post'
import Feed from './pages/Feed'
import Activity from './pages/Activity'
import Discover from './pages/Discover'
import Admin from './pages/Admin'

/*
 * App.jsx — Roteamento principal do Dasein
 * 
 * Fluxo de entrada:
 * - / → Landing (contemplação)
 * - /DSEIN-XXXXX → Landing (código capturado da URL)
 * 
 * A Landing gerencia todo o onboarding internamente:
 * código → signup → profile → /feed
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: true
    }
  }
})

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  
  if (loading) return <div className="screen-center"><div className="spinner" /></div>
  if (!user || !profile) return <Navigate to="/" replace />
  
  return children
}

function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()
  
  if (loading) return <div className="screen-center"><div className="spinner" /></div>
  if (user && profile) return <Navigate to="/feed" replace />
  
  return children
}

const NAV_PAGES = ['/feed', '/activity', '/discover', '/profile']

function AppLayout({ children }) {
  const location = useLocation()
  const { user, profile } = useAuth()
  
  const showNav = user && profile && NAV_PAGES.some(path => 
    location.pathname === path || location.pathname.startsWith('/profile/')
  )
  
  return (
    <>
      {children}
      {showNav && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
              
              <Route path="/camera" element={<ProtectedRoute><Camera /></ProtectedRoute>} />
              <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
              <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/post/:id" element={<ProtectedRoute><Post /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              
              <Route path="/:inviteCode" element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

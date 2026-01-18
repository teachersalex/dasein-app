import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Post from './pages/Post'
import Feed from './pages/Feed'

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 min
      retry: 2,
      refetchOnWindowFocus: true
    }
  }
})

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/" replace />
  }
  
  return children
}

// Public Route (redirect if logged in)
function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }
  
  if (user && profile) {
    return <Navigate to="/home" replace />
  }
  
  return children
}

// Invite link handler: getdasein.app/DSEIN-XXXXX
function InviteRoute() {
  const { inviteCode } = useParams()
  const { user, profile, loading } = useAuth()
  
  // If logged in, go home
  if (!loading && user && profile) {
    return <Navigate to="/home" replace />
  }
  
  // Check if it looks like a valid invite code (DSEIN-XXXXX)
  const isValidFormat = /^DSEIN-[A-Z0-9]{5}$/i.test(inviteCode)
  
  if (isValidFormat) {
    // Pass code to Auth via state
    return <Navigate to="/auth" state={{ inviteCode: inviteCode.toUpperCase() }} replace />
  }
  
  // Not a valid invite code format, go to landing
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected routes */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/post/:id" element={<ProtectedRoute><Post /></ProtectedRoute>} />
            
            {/* Invite link: getdasein.app/DSEIN-XXXXX */}
            <Route path="/:inviteCode" element={<InviteRoute />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
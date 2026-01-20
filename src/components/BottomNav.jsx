import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getReceivedLikes } from '../lib/likes'
import './BottomNav.css'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [hasNewActivity, setHasNewActivity] = useState(false)

  const currentPath = location.pathname

  // Checar se tem atividade nova
  useEffect(() => {
    if (!user) return
    
    async function checkActivity() {
      const likes = await getReceivedLikes(user.uid, 1)
      if (likes.length === 0) {
        setHasNewActivity(false)
        return
      }
      
      const lastActivity = likes[0].createdAt?.toMillis() || 0
      const lastSeen = parseInt(localStorage.getItem('lastActivitySeen') || '0')
      
      setHasNewActivity(lastActivity > lastSeen)
    }
    
    checkActivity()
  }, [user, currentPath])

  // Limpar badge quando entra em Activity
  useEffect(() => {
    if (currentPath === '/activity') {
      setHasNewActivity(false)
    }
  }, [currentPath])

  function isActive(path) {
    if (path === '/profile') {
      return currentPath === '/profile' || currentPath.startsWith('/profile/')
    }
    return currentPath === path
  }

  return (
    <nav className="bottom-nav">
      <button 
        className={`bottom-nav-btn ${isActive('/feed') ? 'active' : ''}`}
        onClick={() => navigate('/feed')}
      >
        <FeedIcon />
      </button>
      <button 
        className={`bottom-nav-btn ${isActive('/activity') ? 'active' : ''}`}
        onClick={() => navigate('/activity')}
      >
        <SparkIcon />
        {hasNewActivity && <span className="nav-badge" />}
      </button>
      <button 
        className="bottom-nav-btn bottom-nav-capture"
        onClick={() => navigate('/home')}
      >
        <CaptureIcon />
      </button>
      <button 
        className={`bottom-nav-btn ${isActive('/discover') ? 'active' : ''}`}
        onClick={() => navigate('/discover')}
      >
        <DiscoverIcon />
      </button>
      <button 
        className={`bottom-nav-btn ${isActive('/profile') ? 'active' : ''}`}
        onClick={() => navigate('/profile')}
      >
        <ProfileIcon />
      </button>
    </nav>
  )
}

function FeedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
    </svg>
  )
}

function CaptureIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
    </svg>
  )
}

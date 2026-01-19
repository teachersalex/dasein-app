import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getReceivedLikes } from '../lib/likes'
import FadeImage from '../components/FadeImage'
import './Activity.css'

export default function Activity() {
  const navigate = useNavigate()
  const { user, profile, getUserProfile } = useAuth()
  
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState({})

  useEffect(() => {
    if (user) {
      loadActivities()
    }
  }, [user])

  async function loadActivities() {
    setLoading(true)
    
    // Buscar likes recebidos
    const likes = await getReceivedLikes(user.uid, 30)
    
    // Transformar em atividades
    const items = likes.map(like => ({
      id: like.id,
      type: 'like',
      userId: like.userId,
      postId: like.postId,
      createdAt: like.createdAt?.toMillis() || Date.now()
    }))
    
    // Ordenar por data
    items.sort((a, b) => b.createdAt - a.createdAt)
    
    setActivities(items)
    
    // Carregar perfis únicos
    const uniqueUserIds = [...new Set(items.map(a => a.userId))]
    const profilesMap = {}
    
    for (const uid of uniqueUserIds) {
      const p = await getUserProfile(uid)
      if (p) profilesMap[uid] = p
    }
    
    setProfiles(profilesMap)
    setLoading(false)
  }

  function formatTime(timestamp) {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'agora'
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  }

  function goToProfile(username) {
    if (username) {
      navigate(`/profile/${username}`)
    }
  }

  function goToPost(postId) {
    navigate(`/post/${postId}`)
  }

  if (loading) {
    return (
      <div className="activity-page">
        <header className="activity-header">
          <h1 className="activity-title">Atividade</h1>
        </header>
        <div className="screen-center">
          <div className="spinner" />
        </div>
        <ActivityNav navigate={navigate} />
      </div>
    )
  }

  return (
    <div className="activity-page fade-in">
      <header className="activity-header">
        <h1 className="activity-title">Atividade</h1>
      </header>

      {activities.length === 0 ? (
        <div className="activity-empty">
          <SparkIconLarge />
          <p>Nenhuma atividade ainda</p>
          <p className="activity-empty-hint">
            Quando alguém curtir suas fotos, você verá aqui
          </p>
        </div>
      ) : (
        <div className="activity-list">
          {activities.map(activity => {
            const actorProfile = profiles[activity.userId]
            
            return (
              <div key={activity.id} className="activity-item">
                <div 
                  className="activity-avatar"
                  onClick={() => goToProfile(actorProfile?.username)}
                >
                  <div className="avatar avatar-sm">
                    {actorProfile?.photoURL ? (
                      <FadeImage src={actorProfile.photoURL} alt={actorProfile.displayName} />
                    ) : (
                      actorProfile?.displayName?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                </div>
                
                <div className="activity-content">
                  <p className="activity-text">
                    <span 
                      className="activity-name"
                      onClick={() => goToProfile(actorProfile?.username)}
                    >
                      {actorProfile?.displayName || 'Alguém'}
                    </span>
                    {activity.type === 'like' && ' curtiu sua foto'}
                    {activity.type === 'visit' && ' visitou seu perfil'}
                  </p>
                  <span className="activity-time">{formatTime(activity.createdAt)}</span>
                </div>
                
                {activity.type === 'like' && (
                  <button 
                    className="activity-post-btn"
                    onClick={() => goToPost(activity.postId)}
                  >
                    Ver
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ActivityNav navigate={navigate} />
    </div>
  )
}

function ActivityNav({ navigate }) {
  return (
    <nav className="feed-nav">
      <button 
        className="feed-nav-btn"
        onClick={() => navigate('/feed')}
      >
        <FeedIcon />
      </button>
      <button 
        className="feed-nav-btn active"
        onClick={() => navigate('/activity')}
      >
        <SparkIcon />
      </button>
      <button 
        className="feed-nav-btn feed-nav-capture"
        onClick={() => navigate('/home')}
      >
        <CaptureIcon />
      </button>
      <button 
        className="feed-nav-btn feed-nav-soon"
        disabled
      >
        <SoonIcon />
      </button>
      <button 
        className="feed-nav-btn"
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

function SparkIconLarge() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
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

function SoonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
      <circle cx="6" cy="12" r="1.5"/>
      <circle cx="12" cy="12" r="1.5"/>
      <circle cx="18" cy="12" r="1.5"/>
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
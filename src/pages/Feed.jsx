import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFeed } from '../hooks/useQueries'
import { getFilterClass } from '../lib/filters'
import { getReceivedLikes } from '../lib/likes'
import FadeImage from '../components/FadeImage'
import './Feed.css'

// ✅ SAFE - Feed de posts de quem o usuário segue
export default function Feed() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  
  const { data, isLoading, error } = useFeed(user?.uid)
  const [hasNewActivity, setHasNewActivity] = useState(false)

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
  }, [user])

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
    navigate(`/profile/${username}`)
  }

  function goToPost(post, author) {
    navigate(`/post/${post.id}`, { state: { post, profile: author } })
  }

  if (isLoading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen-center">
        <p className="text-caption">Erro ao carregar feed</p>
        <button 
          className="btn btn-ghost" 
          onClick={() => window.location.reload()}
          style={{ marginTop: 16 }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const { posts, profiles, empty } = data || { posts: [], profiles: {}, empty: true }

  return (
    <div className="feed-page fade-in">
      <header className="feed-header">
        <h1 className="feed-title">Feed</h1>
        <button 
          className="feed-profile-btn"
          onClick={() => navigate('/profile')}
        >
          <div className="avatar avatar-sm">
            {profile?.photoURL ? (
              <FadeImage src={profile.photoURL} alt={profile.displayName} />
            ) : (
              profile?.displayName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
        </button>
      </header>

      {empty ? (
        <div className="feed-empty">
          <p>Nenhum post ainda.</p>
          <p className="feed-empty-hint">
            Siga pessoas para ver as fotos delas aqui.
          </p>
          <button 
            className="btn" 
            onClick={() => navigate('/profile')}
            style={{ marginTop: 24 }}
          >
            Meu perfil
          </button>
        </div>
      ) : (
        <div className="feed-list">
          {posts.map(post => {
            const author = profiles[post.userId]
            return (
              <article key={post.id} className="feed-item">
                <header 
                  className="feed-item-header"
                  onClick={() => author && goToProfile(author.username)}
                >
                  <div className="avatar avatar-sm">
                    {author?.photoURL ? (
                      <FadeImage src={author.photoURL} alt={author.displayName} />
                    ) : (
                      author?.displayName?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                  <div className="feed-item-meta">
                    <span className="feed-item-author">{author?.displayName || 'Usuário'}</span>
                    <span className="feed-item-time">{formatTime(post.createdAt)}</span>
                  </div>
                </header>
                
                <div 
                  className="feed-item-photo"
                  onClick={() => goToPost(post, author)}
                >
                  <FadeImage 
                    src={post.photoURL} 
                    alt=""
                    className={getFilterClass(post.filter)}
                  />
                </div>
                
                {post.caption && (
                  <p className="feed-item-caption">{post.caption}</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      <nav className="feed-nav">
        <button 
          className="feed-nav-btn active"
          onClick={() => navigate('/feed')}
        >
          <FeedIcon />
        </button>
        <button 
          className="feed-nav-btn"
          onClick={() => navigate('/activity')}
        >
          <SparkIcon />
          {hasNewActivity && <span className="nav-badge" />}
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
    </div>
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
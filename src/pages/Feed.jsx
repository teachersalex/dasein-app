import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFeed } from '../hooks/useQueries'
import { getFilterClass } from '../lib/filters'
import FadeImage from '../components/FadeImage'
import DoubleTapPhoto from '../components/DoubleTapPhoto'
import './Feed.css'

// ✅ SAFE - Feed de posts de quem o usuário segue + seus próprios
export default function Feed() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  
  const { data, isLoading, error } = useFeed(user?.uid)

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

  function goToPost(post, author, index) {
    navigate(`/post/${post.id}`, { 
      state: { 
        post, 
        profile: author,
        posts,      // Array completo para swipe
        profiles,   // Mapa de perfis
        index       // Posição atual
      } 
    })
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
            onClick={() => navigate('/discover')}
            style={{ marginTop: 24 }}
          >
            Descobrir pessoas
          </button>
        </div>
      ) : (
        <div className="feed-list">
          {posts.map((post, index) => {
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
                
                <div className="feed-item-photo">
                  <DoubleTapPhoto 
                    src={post.photoURL}
                    className={getFilterClass(post.filter)}
                    postId={post.id}
                    postOwnerId={post.userId}
                    userId={user?.uid}
                    onClick={() => goToPost(post, author, index)}
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
    </div>
  )
}
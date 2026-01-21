import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFeed } from '../hooks/useQueries'
import { getFilterClass } from '../lib/filters'
import { formatTime } from '../lib/utils'
import FadeImage from '../components/FadeImage'
import DoubleTapPhoto from '../components/DoubleTapPhoto'
import './Feed.css'

/*
 * Feed — Timeline de posts
 * 
 * Mostra posts de quem o usuário segue + seus próprios.
 * Empty state contemplativo para novos usuários.
 */

export default function Feed() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  
  const { data, isLoading, error } = useFeed(user?.uid)

  function goToProfile(username) {
    navigate(`/profile/${username}`)
  }

  function goToPost(post, author, index) {
    navigate(`/post/${post.id}`, { 
      state: { 
        post, 
        profile: author,
        posts,
        profiles,
        index
      } 
    })
  }

  if (isLoading) {
    return (
      <div className="feed-page">
        <div className="screen-center">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="feed-page">
        <div className="screen-center">
          <p className="feed-error-text">algo deu errado</p>
          <button 
            className="feed-retry-btn" 
            onClick={() => window.location.reload()}
          >
            tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const { posts, profiles, empty } = data || { posts: [], profiles: {}, empty: true }

  return (
    <div className="feed-page">
      <header className="feed-header">
        <h1 className="feed-logo">Dasein</h1>
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
          <div className="feed-empty-content">
            <p className="feed-empty-title">seu feed está vazio</p>
            <p className="feed-empty-hint">
              siga pessoas para ver<br />as histórias delas aqui
            </p>
            <button 
              className="feed-empty-btn" 
              onClick={() => navigate('/discover')}
            >
              descobrir pessoas
            </button>
          </div>
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
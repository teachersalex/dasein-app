import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPost, deletePost } from '../lib/posts'
import { likePost, unlikePost, hasLiked, getPostLikes } from '../lib/likes'
import { getFilterClass } from '../lib/filters'
import FadeImage from '../components/FadeImage'
import './Post.css'

export default function Post() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { user, getUserProfile } = useAuth()
  
  // ✅ SAFE - location.state é otimização (evita fetch se já tem dados)
  const [post, setPost] = useState(location.state?.post || null)
  const [author, setAuthor] = useState(location.state?.profile || null)
  const [loading, setLoading] = useState(!post)
  const [deleting, setDeleting] = useState(false)
  const [liked, setLiked] = useState(false)
  const [liking, setLiking] = useState(false)
  const [showHeart, setShowHeart] = useState(false)
  const [likers, setLikers] = useState([])
  const [likersProfiles, setLikersProfiles] = useState({})
  const [showLikers, setShowLikers] = useState(false)
  const lastTap = useRef(0)

  // 🔒 SECURITY - só dono pode deletar
  const isOwner = user && post && user.uid === post.userId

  useEffect(() => {
    if (!post) {
      loadPost()
    } else if (!author) {
      loadAuthor()
    }
  }, [id])

  // Checar se já curtiu
  useEffect(() => {
    if (user && post) {
      hasLiked(user.uid, post.id).then(setLiked)
      loadLikers()
    }
  }, [user, post?.id])

  async function loadLikers() {
    const likes = await getPostLikes(post.id)
    setLikers(likes)
    
    // Carregar perfis de quem curtiu
    const profiles = {}
    for (const like of likes.slice(0, 10)) {
      const p = await getUserProfile(like.userId)
      if (p) profiles[like.userId] = p
    }
    setLikersProfiles(profiles)
  }

  async function loadPost() {
    const postData = await getPost(id)
    if (postData) {
      setPost(postData)
      loadAuthor(postData.userId)
    }
    setLoading(false)
  }

  async function loadAuthor(userId) {
    const uid = userId || post?.userId
    if (uid) {
      const profile = await getUserProfile(uid)
      setAuthor(profile)
    }
  }

  async function handleDelete() {
    if (!confirm('Apagar esta foto?')) return
    
    setDeleting(true)
    
    // ⚠️ CRITICAL - deletePost(id, storagePath) ordem inviolável
    const result = await deletePost(post.id, post.storagePath)
    
    if (result.success) {
      navigate('/profile', { replace: true })
    } else {
      alert('Erro ao apagar foto.')
      setDeleting(false)
    }
  }

  async function handleLike() {
    if (!user || liking) return
    
    setLiking(true)
    const newLiked = !liked
    setLiked(newLiked) // Optimistic update
    
    const result = newLiked
      ? await likePost(user.uid, post.id, post.userId)
      : await unlikePost(user.uid, post.id)
    
    if (!result.success) {
      setLiked(!newLiked) // Rollback
    } else if (newLiked) {
      loadLikers() // Atualiza lista
    }
    
    setLiking(false)
  }

  async function handleDoubleTap(e) {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap!
      e.preventDefault()
      
      if (navigator.vibrate) navigator.vibrate(10)
      
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 1000)
      
      if (!liked) {
        setLiked(true)
        await likePost(user.uid, post.id, post.userId)
        loadLikers()
      }
    }
    
    lastTap.current = now
  }

  function goToProfile() {
    if (author?.username) {
      if (isOwner) {
        navigate('/profile')
      } else {
        navigate(`/profile/${author.username}`)
      }
    }
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
    if (minutes < 60) return `há ${minutes}min`
    if (hours < 24) return `há ${hours}h`
    if (days < 7) return `há ${days} dias`
    return date.toLocaleDateString('pt-BR')
  }

  // Swipe to go back
  useEffect(() => {
    let startX = 0
    let startY = 0

    function handleTouchStart(e) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    function handleTouchEnd(e) {
      const deltaX = e.changedTouches[0].clientX - startX
      const deltaY = Math.abs(e.changedTouches[0].clientY - startY)
      
      if (deltaX > 80 && deltaY < 50) {
        navigate(-1)
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="screen-center">
        <p className="text-caption">Post não encontrado</p>
      </div>
    )
  }

  return (
    <div className="post-page fade-in">
      <header className="post-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        
        {isOwner && (
          <button 
            className="btn-delete" 
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '...' : <TrashIcon />}
          </button>
        )}
      </header>
      
      <div className="post-photo-container" onClick={handleDoubleTap}>
        <FadeImage 
          src={post.photoURL} 
          alt="" 
          className={`post-photo ${getFilterClass(post.filter)}`}
        />
        
        {showHeart && (
          <div className="post-heart-animation">
            <HeartAnimated />
          </div>
        )}
      </div>
      
      <div className="post-info">
        <div className="post-actions">
          <button 
            className={`btn-like ${liked ? 'liked' : ''}`}
            onClick={handleLike}
            disabled={liking}
          >
            <HeartIcon liked={liked} />
          </button>
          
          {likers.length > 0 && (
            <button 
              className="btn-likers"
              onClick={() => setShowLikers(true)}
            >
              <div className="likers-avatars">
                {likers.slice(0, 3).map((like, i) => {
                  const p = likersProfiles[like.userId]
                  return (
                    <div 
                      key={like.id} 
                      className="liker-avatar"
                      style={{ zIndex: 3 - i }}
                    >
                      {p?.photoURL ? (
                        <FadeImage src={p.photoURL} alt="" />
                      ) : (
                        <span>{p?.displayName?.charAt(0) || '?'}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </button>
          )}
        </div>
        
        {post.caption && (
          <p className="post-caption">{post.caption}</p>
        )}
        
        <div className="post-meta" onClick={goToProfile}>
          <div className="avatar avatar-sm">
            {author?.photoURL ? (
              <FadeImage src={author.photoURL} alt={author.displayName} />
            ) : (
              author?.displayName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          
          <div className="post-meta-text">
            <span className="post-author">{author?.displayName || 'Usuário'}</span>
            <span className="post-time">{formatTime(post.createdAt)}</span>
          </div>
        </div>
      </div>
      
      {/* Modal de quem curtiu */}
      {showLikers && (
        <div className="likers-modal" onClick={() => setShowLikers(false)}>
          <div className="likers-content" onClick={e => e.stopPropagation()}>
            <header className="likers-header">
              <h2>Curtidas</h2>
              <button onClick={() => setShowLikers(false)}>
                <CloseIcon />
              </button>
            </header>
            
            <div className="likers-list">
              {likers.map(like => {
                const p = likersProfiles[like.userId]
                return (
                  <div 
                    key={like.id}
                    className="liker-item"
                    onClick={() => {
                      setShowLikers(false)
                      if (p?.username) {
                        if (like.userId === user?.uid) {
                          navigate('/profile')
                        } else {
                          navigate(`/profile/${p.username}`)
                        }
                      }
                    }}
                  >
                    <div className="avatar avatar-sm">
                      {p?.photoURL ? (
                        <FadeImage src={p.photoURL} alt={p.displayName} />
                      ) : (
                        <span>{p?.displayName?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <span className="liker-name">{p?.displayName || 'Usuário'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  )
}

function HeartIcon({ liked }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" strokeWidth="1.5">
      <defs>
        <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="50%" stopColor="#a0a0a0" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
      <path 
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill={liked ? "url(#silverGrad)" : "none"}
        stroke={liked ? "url(#silverGrad)" : "#666"}
      />
    </svg>
  )
}

function HeartAnimated() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="silverGradBig" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="50%" stopColor="#a8a8a8" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
      <path 
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill="url(#silverGradBig)"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  )
}
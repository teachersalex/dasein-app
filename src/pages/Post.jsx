import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPost, deletePost } from '../lib/posts'
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

  // 🔒 SECURITY - só dono pode deletar
  const isOwner = user && post && user.uid === post.userId

  useEffect(() => {
    if (!post) {
      loadPost()
    } else if (!author) {
      loadAuthor()
    }
  }, [id])

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
      
      <div className="post-photo-container">
        <FadeImage 
          src={post.photoURL} 
          alt="" 
          className={`post-photo ${getFilterClass(post.filter)}`}
        />
      </div>
      
      <div className="post-info">
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
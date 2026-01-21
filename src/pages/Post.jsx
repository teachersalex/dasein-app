import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPost, deletePost } from '../lib/posts'
import { likePost, unlikePost, hasLiked, getPostLikes } from '../lib/likes'
import { getFilterClass } from '../lib/filters'
import { formatTimeAgo } from '../lib/utils'
import FadeImage from '../components/FadeImage'
import './Post.css'

// ✅ Componente individual de cada post (evita re-mount)
function PostItem({ 
  post, 
  author, 
  user, 
  getUserProfile,
  isVisible,
  onAuthorClick 
}) {
  const [liked, setLiked] = useState(false)
  const [likers, setLikers] = useState([])
  const [likersProfiles, setLikersProfiles] = useState({})
  const [showLikers, setShowLikers] = useState(false)
  const [showHeart, setShowHeart] = useState(false)
  const [liking, setLiking] = useState(false)
  
  // 🔒 Esconde ações até dados chegarem
  const [dataReady, setDataReady] = useState(false)
  
  // 🔒 Animação só quando usuário clica
  const [justLiked, setJustLiked] = useState(false)
  
  // Tap detection
  const tapTimer = useRef(null)
  const tapCount = useRef(0)
  
  // 🔒 Carrega likes UMA vez quando monta
  useEffect(() => {
    if (user && post) {
      loadAllData()
    }
    
    async function loadAllData() {
      // Busca tudo em paralelo
      const [likedResult, likesResult] = await Promise.all([
        hasLiked(user.uid, post.id),
        getPostLikes(post.id)
      ])
      
      // Seta os dados
      setLiked(likedResult)
      setLikers(likesResult)
      
      // 🔧 FIX: Promise.all para carregar perfis em paralelo
      const likesToLoad = likesResult.slice(0, 10)
      const profilesArray = await Promise.all(
        likesToLoad.map(like => getUserProfile(like.userId))
      )
      
      const profiles = {}
      likesToLoad.forEach((like, index) => {
        if (profilesArray[index]) {
          profiles[like.userId] = profilesArray[index]
        }
      })
      setLikersProfiles(profiles)
      
      // Agora sim, mostra tudo
      setDataReady(true)
    }
  }, [user, post?.id])
  
  async function loadLikers() {
    if (!post?.id) return
    
    const likes = await getPostLikes(post.id)
    setLikers(likes)
    
    // 🔧 FIX: Promise.all para perfis
    const likesToLoad = likes.slice(0, 10)
    const profilesArray = await Promise.all(
      likesToLoad.map(like => getUserProfile(like.userId))
    )
    
    const profiles = {}
    likesToLoad.forEach((like, index) => {
      if (profilesArray[index]) {
        profiles[like.userId] = profilesArray[index]
      }
    })
    setLikersProfiles(profiles)
  }
  
  const handleLike = useCallback(async () => {
    if (!user || liking) return
    
    const newLiked = !liked
    setLiked(newLiked)
    setLiking(true)
    
    // 🔒 Animação só quando curte (não quando descurte)
    if (newLiked) {
      setJustLiked(true)
      setTimeout(() => setJustLiked(false), 350)
    }
    
    const result = newLiked
      ? await likePost(user.uid, post.id, post.userId)
      : await unlikePost(user.uid, post.id)
    
    if (!result.success) {
      setLiked(!newLiked)
    } else if (newLiked) {
      loadLikers()
    }
    
    setLiking(false)
  }, [user, post, liked, liking])
  
  const handlePhotoTap = useCallback(() => {
    tapCount.current++
    
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0
      }, 300)
    } else if (tapCount.current === 2) {
      clearTimeout(tapTimer.current)
      tapCount.current = 0
      
      if (navigator.vibrate) navigator.vibrate(10)
      
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 1000)
      
      if (!liked && user) {
        setLiked(true)
        likePost(user.uid, post.id, post.userId).then(() => loadLikers())
      }
    }
  }, [liked, user, post])
  
  return (
    <div className="post-item">
      <div className="post-photo-container" onClick={handlePhotoTap}>
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
        <div className={`post-actions ${dataReady ? 'data-ready' : ''}`}>
          <button 
            className={`btn-like ${liked ? 'liked' : ''} ${justLiked ? 'just-liked' : ''}`}
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
        
        <div className="post-meta" onClick={onAuthorClick}>
          <div className="avatar avatar-sm">
            {author?.photoURL ? (
              <FadeImage src={author.photoURL} alt={author.displayName} />
            ) : (
              author?.displayName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          
          <div className="post-meta-text">
            <span className="post-author">{author?.displayName || 'Usuário'}</span>
            {/* 🔧 FIX: Usa formatTimeAgo do utils */}
            <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>
      
      {/* Modal de quem curtiu */}
      {showLikers && (
        <LikersModal 
          likers={likers}
          likersProfiles={likersProfiles}
          user={user}
          onClose={() => setShowLikers(false)}
        />
      )}
    </div>
  )
}

// ✅ Modal de likers separado
function LikersModal({ likers, likersProfiles, user, onClose }) {
  const navigate = useNavigate()
  
  return (
    <div className="likers-modal" onClick={onClose}>
      <div className="likers-content" onClick={e => e.stopPropagation()}>
        <header className="likers-header">
          <h2>Curtidas</h2>
          <button onClick={onClose}>
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
                  onClose()
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
  )
}

// ✅ Componente principal
export default function Post() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { user, getUserProfile } = useAuth()
  
  // Dados do contexto (vindo do Profile ou Feed)
  const allPosts = location.state?.posts || []
  const allProfiles = location.state?.profiles || {}
  const initialIndex = location.state?.index ?? 0
  
  // Fallback: post único
  const [singlePost, setSinglePost] = useState(location.state?.post || null)
  const [singleAuthor, setSingleAuthor] = useState(location.state?.profile || null)
  const [loading, setLoading] = useState(!singlePost && allPosts.length === 0)
  
  // Refs para scroll
  const containerRef = useRef(null)
  const itemRefs = useRef({})
  
  // Estado do post visível (para o header)
  const [visibleIndex, setVisibleIndex] = useState(initialIndex)
  const [deleting, setDeleting] = useState(false)
  
  // 🔧 FIX: Estado para ConfirmModal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Posts a renderizar
  const posts = allPosts.length > 0 ? allPosts : (singlePost ? [singlePost] : [])
  const currentPost = posts[visibleIndex]
  const currentAuthor = allPosts.length > 0 
    ? allProfiles[currentPost?.userId] 
    : singleAuthor
  
  // 🔒 Só dono pode deletar
  const isOwner = user && currentPost && user.uid === currentPost.userId
  
  // Carregar post único se não veio pelo state
  useEffect(() => {
    if (!singlePost && allPosts.length === 0) {
      loadSinglePost()
    }
  }, [id])
  
  // Scroll inicial para o post clicado
  useEffect(() => {
    if (posts.length > 0 && itemRefs.current[initialIndex]) {
      // Pequeno delay para garantir que o DOM está pronto
      setTimeout(() => {
        itemRefs.current[initialIndex]?.scrollIntoView({ 
          behavior: 'instant',
          block: 'start'
        })
      }, 50)
    }
  }, [posts.length, initialIndex])
  
  // Intersection Observer para detectar post visível
  useEffect(() => {
    if (posts.length <= 1) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.dataset.index, 10)
            setVisibleIndex(index)
          }
        })
      },
      { 
        root: containerRef.current,
        threshold: 0.6 
      }
    )
    
    Object.values(itemRefs.current).forEach(ref => {
      if (ref) observer.observe(ref)
    })
    
    return () => observer.disconnect()
  }, [posts.length])
  
  async function loadSinglePost() {
    const postData = await getPost(id)
    if (postData) {
      setSinglePost(postData)
      const profile = await getUserProfile(postData.userId)
      setSingleAuthor(profile)
    }
    setLoading(false)
  }
  
  // 🔧 FIX: Usa ConfirmModal em vez de confirm() nativo
  async function handleDelete() {
    setShowDeleteConfirm(false)
    setDeleting(true)
    
    const result = await deletePost(currentPost.id, currentPost.storagePath)
    
    if (result.success) {
      navigate('/profile', { replace: true })
    } else {
      // 🔧 FIX: Usa toast em vez de alert (se disponível)
      // Por ora, só reseta o estado
      setDeleting(false)
    }
  }
  
  function goToAuthorProfile(post, author) {
    if (!author?.username) return
    
    if (user?.uid === post.userId) {
      navigate('/profile')
    } else {
      navigate(`/profile/${author.username}`)
    }
  }
  
  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }
  
  if (posts.length === 0) {
    return (
      <div className="screen-center">
        <p className="text-caption">Post não encontrado</p>
      </div>
    )
  }
  
  return (
    <div className="post-page">
      {/* Header fixo */}
      <header className="post-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        
        <div className="header-spacer" />
        
        {isOwner && (
          <button 
            className="btn-delete" 
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
          >
            {deleting ? '...' : <TrashIcon />}
          </button>
        )}
      </header>
      
      {/* Container com scroll vertical */}
      <div className="posts-scroll-container" ref={containerRef}>
        {posts.map((post, index) => {
          const author = allPosts.length > 0 
            ? allProfiles[post.userId] 
            : singleAuthor
          
          return (
            <div 
              key={post.id}
              ref={el => itemRefs.current[index] = el}
              data-index={index}
              className="post-scroll-item"
            >
              <PostItem
                post={post}
                author={author}
                user={user}
                getUserProfile={getUserProfile}
                isVisible={visibleIndex === index}
                onAuthorClick={() => goToAuthorProfile(post, author)}
              />
            </div>
          )
        })}
      </div>
      
      {/* 🔧 FIX: ConfirmModal em vez de confirm() nativo */}
      {showDeleteConfirm && (
        <ConfirmModal
          message="apagar esta foto?"
          confirmText="apagar"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}

// 🔧 FIX: ConfirmModal local (mesmo pattern do Profile.jsx)
function ConfirmModal({ message, confirmText, onConfirm, onCancel }) {
  return (
    <div className="confirm-modal" onClick={onCancel}>
      <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>
            cancelar
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// ========== ICONS ==========

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
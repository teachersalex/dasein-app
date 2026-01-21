import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPost, deletePost } from '../lib/posts'
import { likePost, unlikePost, hasLiked, getPostLikes } from '../lib/likes'
import { getFilterClass } from '../lib/filters'
import { formatTimeAgo } from '../lib/utils'
import FadeImage from '../components/FadeImage'
import './Post.css'

/*
 * Post.jsx — Visualização de post com scroll vertical
 * 
 * Features:
 * - Scroll snap vertical entre posts
 * - Double tap para curtir
 * - Modal de quem curtiu
 * - Delete para o dono
 */

// === Post Individual ===
function PostItem({ 
  post, 
  author, 
  user, 
  getUserProfile,
  onAuthorClick 
}) {
  const [liked, setLiked] = useState(false)
  const [likers, setLikers] = useState([])
  const [likersProfiles, setLikersProfiles] = useState({})
  const [showLikers, setShowLikers] = useState(false)
  const [showHeart, setShowHeart] = useState(false)
  const [liking, setLiking] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [justLiked, setJustLiked] = useState(false)
  
  const tapTimer = useRef(null)
  const tapCount = useRef(0)
  
  // Carrega dados em paralelo
  useEffect(() => {
    if (user && post) {
      loadAllData()
    }
    
    async function loadAllData() {
      const [likedResult, likesResult] = await Promise.all([
        hasLiked(user.uid, post.id),
        getPostLikes(post.id)
      ])
      
      setLiked(likedResult)
      setLikers(likesResult)
      
      // Perfis em paralelo
      const profilePromises = likesResult.slice(0, 10).map(like => 
        getUserProfile(like.userId)
      )
      const profileResults = await Promise.all(profilePromises)
      
      const profiles = {}
      likesResult.slice(0, 10).forEach((like, index) => {
        if (profileResults[index]) {
          profiles[like.userId] = profileResults[index]
        }
      })
      setLikersProfiles(profiles)
      setDataReady(true)
    }
  }, [user, post?.id])
  
  async function loadLikers() {
    if (!post?.id) return
    
    const likes = await getPostLikes(post.id)
    setLikers(likes)
    
    const profilePromises = likes.slice(0, 10).map(like => 
      getUserProfile(like.userId)
    )
    const profileResults = await Promise.all(profilePromises)
    
    const profiles = {}
    likes.slice(0, 10).forEach((like, index) => {
      if (profileResults[index]) {
        profiles[like.userId] = profileResults[index]
      }
    })
    setLikersProfiles(profiles)
  }
  
  const handleLike = useCallback(async () => {
    if (!user || liking) return
    
    const newLiked = !liked
    setLiked(newLiked)
    setLiking(true)
    
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
        setJustLiked(true)
        setTimeout(() => setJustLiked(false), 350)
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
        <div className={`post-actions ${dataReady ? 'visible' : ''}`}>
          <button 
            className={`btn-like ${liked ? 'liked' : ''} ${justLiked ? 'animate' : ''}`}
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
              <div className="likers-stack">
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
        
        <div className="post-author-row" onClick={onAuthorClick}>
          <div className="avatar avatar-sm">
            {author?.photoURL ? (
              <FadeImage src={author.photoURL} alt={author.displayName} />
            ) : (
              author?.displayName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          
          <div className="post-author-info">
            <span className="post-author-name">{author?.displayName || 'Usuário'}</span>
            <span className="post-author-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>
      
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

// === Modal de Likers ===
function LikersModal({ likers, likersProfiles, user, onClose }) {
  const navigate = useNavigate()
  
  return (
    <div className="likers-modal" onClick={onClose}>
      <div className="likers-sheet" onClick={e => e.stopPropagation()}>
        <header className="likers-header">
          <h2>curtidas</h2>
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

// === Componente Principal ===
export default function Post() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const { user, getUserProfile } = useAuth()
  
  const allPosts = location.state?.posts || []
  const allProfiles = location.state?.profiles || {}
  const initialIndex = location.state?.index ?? 0
  
  const [singlePost, setSinglePost] = useState(location.state?.post || null)
  const [singleAuthor, setSingleAuthor] = useState(location.state?.profile || null)
  const [loading, setLoading] = useState(!singlePost && allPosts.length === 0)
  
  const containerRef = useRef(null)
  const itemRefs = useRef({})
  
  const [visibleIndex, setVisibleIndex] = useState(initialIndex)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const posts = allPosts.length > 0 ? allPosts : (singlePost ? [singlePost] : [])
  const currentPost = posts[visibleIndex]
  const currentAuthor = allPosts.length > 0 
    ? allProfiles[currentPost?.userId] 
    : singleAuthor
  
  const isOwner = user && currentPost && user.uid === currentPost.userId
  
  useEffect(() => {
    if (!singlePost && allPosts.length === 0) {
      loadSinglePost()
    }
  }, [id])
  
  useEffect(() => {
    if (posts.length > 0 && itemRefs.current[initialIndex]) {
      setTimeout(() => {
        itemRefs.current[initialIndex]?.scrollIntoView({ 
          behavior: 'instant',
          block: 'start'
        })
      }, 50)
    }
  }, [posts.length, initialIndex])
  
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
  
  async function handleDelete() {
    setDeleting(true)
    
    const result = await deletePost(currentPost.id, currentPost.storagePath)
    
    if (result.success) {
      navigate('/profile', { replace: true })
    } else {
      setDeleting(false)
      setShowDeleteConfirm(false)
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
      <div className="post-page">
        <div className="screen-center">
          <div className="spinner" />
        </div>
      </div>
    )
  }
  
  if (posts.length === 0) {
    return (
      <div className="post-page">
        <div className="screen-center">
          <p className="post-not-found">post não encontrado</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="post-page">
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
            <TrashIcon />
          </button>
        )}
      </header>
      
      <div className="posts-scroll" ref={containerRef}>
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
                onAuthorClick={() => goToAuthorProfile(post, author)}
              />
            </div>
          )
        })}
      </div>
      
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="delete-modal" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-sheet" onClick={e => e.stopPropagation()}>
            <p className="delete-message">apagar esta foto?</p>
            <div className="delete-actions">
              <button 
                className="delete-cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                cancelar
              </button>
              <button 
                className="delete-confirm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '...' : 'apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Icons ===

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
        <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="50%" stopColor="#a0a0a0" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
      <path 
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill={liked ? "url(#heartGrad)" : "none"}
        stroke={liked ? "url(#heartGrad)" : "rgba(255,255,255,0.4)"}
      />
    </svg>
  )
}

function HeartAnimated() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="heartGradBig" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="50%" stopColor="#a8a8a8" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
      <path 
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill="url(#heartGradBig)"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  )
}
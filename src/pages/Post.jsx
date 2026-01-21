import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPost, deletePost } from '../lib/posts'
import { likePost, unlikePost, hasLiked, getPostLikes } from '../lib/likes'
import { getFilterClass } from '../lib/filters'
import { formatTimeAgo } from '../lib/utils'
import FadeImage from '../components/FadeImage'
import ConfirmModal from '../components/ui/ConfirmModal'
import BottomSheet from '../components/ui/BottomSheet'
import { BackIcon, TrashIcon, HeartIcon, HeartAnimated } from '../components/Icons'
import './Post.css'

/*
 * Post.jsx — Visualização de posts com scroll vertical
 * 
 * Features:
 * - Scroll snap vertical entre posts
 * - Double tap para curtir
 * - Modal de quem curtiu (BottomSheet)
 * - Delete do próprio post (ConfirmModal)
 * 
 * Refatorado:
 * - ConfirmModal extraído para components/ui
 * - LikersModal usa BottomSheet genérico
 * - Ícones em components/Icons.jsx (com useId para gradients)
 * - Fix: behavior 'auto' no scrollIntoView
 * - Fix: double tap usa handleLike com lock
 */

// ============================================
// PostItem - Componente individual de cada post
// ============================================

function PostItem({ 
  post, 
  author, 
  user, 
  getUserProfile,
  onAuthorClick 
}) {
  const navigate = useNavigate()
  
  const [liked, setLiked] = useState(false)
  const [likers, setLikers] = useState([])
  const [likersProfiles, setLikersProfiles] = useState({})
  const [showLikers, setShowLikers] = useState(false)
  const [showHeart, setShowHeart] = useState(false)
  const [liking, setLiking] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [justLiked, setJustLiked] = useState(false)
  
  // Double tap detection
  const tapTimer = useRef(null)
  const tapCount = useRef(0)
  
  // Carrega likes ao montar
  useEffect(() => {
    if (user && post) loadAllData()
    
    async function loadAllData() {
      const [likedResult, likesResult] = await Promise.all([
        hasLiked(user.uid, post.id),
        getPostLikes(post.id)
      ])
      
      setLiked(likedResult)
      setLikers(likesResult)
      
      // Carrega perfis dos primeiros 10 likers
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
      setDataReady(true)
    }
  }, [user, post?.id])
  
  async function loadLikers() {
    if (!post?.id) return
    
    const likes = await getPostLikes(post.id)
    setLikers(likes)
    
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

  // Carrega perfis extras quando abre o modal (lazy load)
  async function handleOpenLikers() {
    setShowLikers(true)
    
    // Carrega perfis que ainda não foram carregados
    const missingLikers = likers.filter(like => !likersProfiles[like.userId])
    if (missingLikers.length > 0) {
      const profilesArray = await Promise.all(
        missingLikers.map(like => getUserProfile(like.userId))
      )
      
      const newProfiles = { ...likersProfiles }
      missingLikers.forEach((like, index) => {
        if (profilesArray[index]) {
          newProfiles[like.userId] = profilesArray[index]
        }
      })
      setLikersProfiles(newProfiles)
    }
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
  
  // 🔧 FIX: Double tap agora usa handleLike com lock (evita race condition)
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
      
      // 🔧 FIX: Só curte se não curtiu ainda E usa o lock
      if (!liked && !liking) {
        handleLike()
      }
    }
  }, [liked, liking, handleLike])

  function navigateToProfile(userId, username) {
    if (!username) return
    if (userId === user?.uid) {
      navigate('/profile')
    } else {
      navigate(`/profile/${username}`)
    }
  }
  
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
            <button className="btn-likers" onClick={handleOpenLikers}>
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
            <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>
      
      {/* Modal de quem curtiu - usando BottomSheet */}
      {showLikers && (
        <BottomSheet title="curtidas" onClose={() => setShowLikers(false)}>
          {likers.map(like => {
            const p = likersProfiles[like.userId]
            return (
              <div 
                key={like.id}
                className="bottom-sheet-item"
                onClick={() => {
                  setShowLikers(false)
                  navigateToProfile(like.userId, p?.username)
                }}
              >
                <div className="avatar avatar-sm">
                  {p?.photoURL ? (
                    <FadeImage src={p.photoURL} alt={p.displayName} />
                  ) : (
                    <span>{p?.displayName?.charAt(0) || '?'}</span>
                  )}
                </div>
                <span className="bottom-sheet-item-name">{p?.displayName || 'Usuário'}</span>
              </div>
            )
          })}
        </BottomSheet>
      )}
    </div>
  )
}

// ============================================
// Post - Componente principal (página)
// ============================================

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
  
  // Estado
  const [visibleIndex, setVisibleIndex] = useState(initialIndex)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Posts a renderizar
  const posts = allPosts.length > 0 ? allPosts : (singlePost ? [singlePost] : [])
  const currentPost = posts[visibleIndex]
  const currentAuthor = allPosts.length > 0 
    ? allProfiles[currentPost?.userId] 
    : singleAuthor
  
  const isOwner = user && currentPost && user.uid === currentPost.userId
  
  // Carregar post único se não veio pelo state
  useEffect(() => {
    if (!singlePost && allPosts.length === 0) {
      loadSinglePost()
    }
  }, [id])
  
  // 🔧 FIX: behavior 'auto' em vez de 'instant' (mais compatível)
  useEffect(() => {
    if (posts.length > 0 && itemRefs.current[initialIndex]) {
      setTimeout(() => {
        itemRefs.current[initialIndex]?.scrollIntoView({ 
          behavior: 'auto',
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
  
  async function handleDelete() {
    setShowDeleteConfirm(false)
    setDeleting(true)
    
    const result = await deletePost(currentPost.id, currentPost.storagePath)
    
    if (result.success) {
      navigate('/profile', { replace: true })
    } else {
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
  
  // Loading
  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }
  
  // Not found
  if (posts.length === 0) {
    return (
      <div className="screen-center">
        <p className="post-not-found">post não encontrado</p>
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
                onAuthorClick={() => goToAuthorProfile(post, author)}
              />
            </div>
          )
        })}
      </div>
      
      {/* Modal de confirmação de delete */}
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

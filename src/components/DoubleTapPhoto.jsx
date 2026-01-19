import { useState, useRef, useCallback } from 'react'
import { likePost, hasLiked } from '../lib/likes'
import FadeImage from './FadeImage'
import './DoubleTapPhoto.css'

// Double tap pra curtir, single tap pra abrir
// Lógica limpa: espera 300ms após primeiro tap
// Se vier segundo tap → curte
// Se não → abre post
export default function DoubleTapPhoto({ 
  src, 
  alt = '', 
  className = '',
  postId,
  postOwnerId,
  userId,
  onClick
}) {
  const [showHeart, setShowHeart] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const tapTimer = useRef(null)
  const tapCount = useRef(0)

  const handleTap = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    tapCount.current++
    
    if (tapCount.current === 1) {
      // Primeiro tap - espera pra ver se vem outro
      tapTimer.current = setTimeout(() => {
        // Single tap confirmado → abre post
        if (tapCount.current === 1) {
          onClick?.()
        }
        tapCount.current = 0
      }, 300)
    } else if (tapCount.current === 2) {
      // Double tap! Cancela o timer do single tap
      clearTimeout(tapTimer.current)
      tapCount.current = 0
      
      // Vibração
      if (navigator.vibrate) navigator.vibrate(10)
      
      // Animação do coração
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 1000)
      
      // Curtir (se não estiver já curtindo)
      if (!isLiking && userId && postId) {
        setIsLiking(true)
        
        const alreadyLiked = await hasLiked(userId, postId)
        if (!alreadyLiked) {
          await likePost(userId, postId, postOwnerId)
        }
        
        setIsLiking(false)
      }
    }
  }, [onClick, userId, postId, postOwnerId, isLiking])

  return (
    <div className="double-tap-container" onClick={handleTap}>
      <FadeImage src={src} alt={alt} className={className} />
      
      {showHeart && (
        <div className="double-tap-heart">
          <HeartIcon />
        </div>
      )}
    </div>
  )
}

function HeartIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="url(#silverGradient)">
      <defs>
        <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="50%" stopColor="#a8a8a8" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
import { useState, useRef } from 'react'
import { likePost, hasLiked } from '../lib/likes'
import FadeImage from './FadeImage'
import './DoubleTapPhoto.css'

// Double tap pra curtir com animação do coração prata
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
  const lastTap = useRef(0)

  async function handleTap(e) {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap!
      e.preventDefault()
      e.stopPropagation()
      
      // Vibração
      if (navigator.vibrate) navigator.vibrate(10)
      
      // Animação do coração
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 1000)
      
      // Curtir (se ainda não curtiu)
      const alreadyLiked = await hasLiked(userId, postId)
      if (!alreadyLiked) {
        await likePost(userId, postId, postOwnerId)
      }
    } else {
      // Single tap - espera pra ver se vem outro
      lastTap.current = now
      
      // Delay antes de executar onClick (pra dar tempo do double tap)
      setTimeout(() => {
        if (Date.now() - lastTap.current >= DOUBLE_TAP_DELAY) {
          onClick?.()
        }
      }, DOUBLE_TAP_DELAY)
    }
  }

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

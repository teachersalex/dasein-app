import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { uploadPost } from '../lib/posts'
import { FILTERS, applyFilter } from '../lib/filters'
import HomeCamera from './HomeCamera'
import { 
  RetakeIcon, 
  ArrowIcon, 
  BackIcon, 
  CheckIcon, 
  SuccessAnimation 
} from './HomeIcons'
import './Home.css'
import './preview.css'
import './caption.css'

/*
 * Home — Fluxo de captura e publicação
 * 
 * Telas:
 * 1. camera — captura com crop 4:5
 * 2. preview — seleção de filtro com swipe
 * 3. caption — legenda opcional
 * 4. success — feedback e redirect
 * 
 * Fixes aplicados:
 * - resetVisualState: translateY → translateX
 * - handlePost: guarda de user?.uid
 * - redirectTimeout com cleanup
 */

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [screen, setScreen] = useState('camera')
  const [photoData, setPhotoData] = useState(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [filteredPhoto, setFilteredPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)

  const filterNameRef = useRef(null)
  const redirectTimeoutRef = useRef(null)

  // Cleanup do timeout de redirect
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  // Processamento de filtros
  useEffect(() => {
    let isCancelled = false
    
    async function processFilter() {
      if (photoData && screen === 'preview') {
        const filter = FILTERS[filterIndex]
        
        if (!filter.settings) {
          setFilteredPhoto(photoData)
          return
        }
        
        const filtered = await applyFilter(photoData, filter)
        if (!isCancelled) setFilteredPhoto(filtered)
      }
    }
    
    processFilter()
    return () => { isCancelled = true }
  }, [photoData, filterIndex, screen])

  // Navegação de filtros
  function nextFilter() {
    if (filterIndex < FILTERS.length - 1) {
      setFilterIndex(i => i + 1)
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }

  function prevFilter() {
    if (filterIndex > 0) {
      setFilterIndex(i => i - 1)
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }

  // Touch com feedback visual
  const touchState = useRef({ 
    startX: 0, startY: 0, lastX: 0,
    startTime: 0, lastFilterChange: 0, isDragging: false
  })
  
  function handleTouchStart(e) {
    const touch = e.touches[0]
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      startTime: Date.now(),
      lastFilterChange: Date.now(),
      isDragging: true
    }
    
    if (filterNameRef.current) filterNameRef.current.style.transition = 'none'
  }
  
  function handleTouchMove(e) {
    if (!touchState.current.isDragging) return
    
    const touch = e.touches[0]
    const deltaFromStart = touch.clientX - touchState.current.startX
    const deltaFromLast = touch.clientX - touchState.current.lastX
    const deltaY = Math.abs(touch.clientY - touchState.current.startY)
    const now = Date.now()
    
    if (deltaY > 80) {
      touchState.current.isDragging = false
      resetVisualState()
      return
    }
    
    const offset = deltaFromStart / 2.5
    
    if (filterNameRef.current) {
      filterNameRef.current.style.transform = `translateX(${offset * 1.5}px)`
      filterNameRef.current.style.opacity = 1 - Math.abs(offset) / 100
    }
    
    const threshold = 50
    if (now - touchState.current.lastFilterChange > 100) {
      if (deltaFromLast < -threshold) {
        nextFilter()
        touchState.current.lastX = touch.clientX
        touchState.current.lastFilterChange = now
      } else if (deltaFromLast > threshold) {
        prevFilter()
        touchState.current.lastX = touch.clientX
        touchState.current.lastFilterChange = now
      }
    }
  }
  
  function handleTouchEnd(e) {
    if (!touchState.current.isDragging) return
    
    const duration = Date.now() - touchState.current.startTime
    const totalX = e.changedTouches[0].clientX - touchState.current.startX
    
    if (duration < 200 && Math.abs(totalX) > 30) {
      if (totalX < 0) nextFilter()
      else prevFilter()
    }
    
    touchState.current.isDragging = false
    resetVisualState(true)
  }
  
  // FIX: translateY → translateX (você move horizontalmente!)
  function resetVisualState(animate = false) {
    if (filterNameRef.current) {
      filterNameRef.current.style.transition = animate ? 'transform 0.3s ease, opacity 0.3s ease' : 'none'
      filterNameRef.current.style.transform = 'translateX(0)'
      filterNameRef.current.style.opacity = filterIndex !== 0 ? '1' : '0'
    }
  }

  // Handlers
  function handleCapture(photo) {
    setPhotoData(photo)
    setFilteredPhoto(photo)
    setFilterIndex(0)
    setScreen('preview')
  }

  function handleRetake() {
    setPhotoData(null)
    setFilteredPhoto(null)
    setScreen('camera')
  }
  
  // FIX: Guarda de user?.uid
  async function handlePost() {
    if (posting || !filteredPhoto) return
    
    // FIX: Verifica se user existe antes de tentar postar
    if (!user?.uid) {
      showToast('faça login para publicar', 'error')
      return
    }
    
    setPosting(true)
    
    try {
      const result = await uploadPost(
        user.uid,
        filteredPhoto,
        caption,
        FILTERS[filterIndex].name
      )
      
      if (result.success) {
        setScreen('success')
        setCaption('')
        setPhotoData(null)
        setFilteredPhoto(null)
        
        // FIX: Usa ref para cleanup
        redirectTimeoutRef.current = setTimeout(() => navigate('/feed'), 1500)
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Post error:', error)
      showToast('erro ao publicar, tente novamente', 'error')
    }
    
    setPosting(false)
  }

  return (
    <div className="home">
      
      {screen === 'camera' && (
        <HomeCamera 
          onCapture={handleCapture} 
          onClose={() => navigate('/feed')} 
        />
      )}
      
      {screen === 'preview' && (
        <div className="preview-screen">
          <div className="preview-container">
            {filteredPhoto ? (
              <img src={filteredPhoto} alt="Preview" className="preview-image" />
            ) : (
              <div className="preview-loading"><div className="spinner" /></div>
            )}
          </div>
          
          <div className="filter-controls">
            <div 
              ref={filterNameRef} 
              className={`filter-name ${filterIndex !== 0 ? 'visible' : ''}`}
            >
              {FILTERS[filterIndex].name}
            </div>
            
            <div 
              className="filter-indicators"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {FILTERS.map((filter, i) => (
                <button 
                  key={filter.id}
                  className={`filter-bar ${i === filterIndex ? 'active' : ''}`}
                  onClick={() => {
                    setFilterIndex(i)
                    if (navigator.vibrate) navigator.vibrate(5)
                  }}
                />
              ))}
            </div>
          </div>
          
          <div className="preview-actions">
            <button className="preview-btn secondary" onClick={handleRetake}>
              <RetakeIcon /><span>outra</span>
            </button>
            <button 
              className="preview-btn primary" 
              onClick={() => setScreen('caption')} 
              disabled={!filteredPhoto}
            >
              <span>continuar</span><ArrowIcon />
            </button>
          </div>
        </div>
      )}
      
      {screen === 'caption' && (
        <div className="caption-screen">
          <div className="caption-header">
            <button className="caption-back" onClick={() => setScreen('preview')}>
              <BackIcon />
            </button>
            <span className="caption-title">finalizar</span>
            <div style={{ width: 44 }} />
          </div>
          
          <div className="caption-content">
            <div className="caption-preview">
              <img src={filteredPhoto || photoData} alt="" />
            </div>
            <div className="caption-input-wrapper">
              <input
                type="text"
                className="caption-input"
                placeholder="escreva algo..."
                maxLength={140}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                autoFocus
              />
              <span className="caption-count">{caption.length}/140</span>
            </div>
          </div>
          
          <div className="caption-actions">
            <button className="caption-post-btn" onClick={handlePost} disabled={posting}>
              {posting ? (
                <div className="spinner spinner-sm" />
              ) : (
                <>
                  <span>publicar</span>
                  <CheckIcon />
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {screen === 'success' && (
        <div className="success-screen">
          <div className="success-content">
            <SuccessAnimation />
            <h2 className="success-title">publicado</h2>
            <p className="success-subtitle">seu momento foi salvo</p>
          </div>
        </div>
      )}
    </div>
  )
}

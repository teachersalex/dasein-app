import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
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

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [screen, setScreen] = useState('camera')
  const [photoData, setPhotoData] = useState(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [filteredPhoto, setFilteredPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)

  // Ref para feedback visual do nome do filtro
  const filterNameRef = useRef(null)

  // ⚠️ CRITICAL - Processamento de filtros
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

  // ✅ SAFE - navegação de filtros
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

  // Touch com feedback visual (Tension & Snap)
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
    
    // Feedback visual só no nome do filtro
    const offset = deltaFromStart / 2.5
    
    if (filterNameRef.current) {
      filterNameRef.current.style.transform = `translateX(${offset * 1.5}px)`
      filterNameRef.current.style.opacity = 1 - Math.abs(offset) / 100
    }
    
    // Troca de filtro
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
  
  function resetVisualState(animate = false) {
    if (filterNameRef.current) {
      filterNameRef.current.style.transition = animate ? 'transform 0.3s ease, opacity 0.3s ease' : 'none'
      filterNameRef.current.style.transform = 'translateY(0)'
      filterNameRef.current.style.opacity = filterIndex !== 0 ? '1' : '0'
    }
  }

  // 🔒 Handlers críticos
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
  
  // 🔒 ORDEM DOS PARAMS: uploadPost(userId, photoData, caption, filterName)
  async function handlePost() {
    if (posting || !filteredPhoto) return
    setPosting(true)
    
    try {
      const result = await uploadPost(
        user.uid,                    // 1
        filteredPhoto,               // 2
        caption,                     // 3
        FILTERS[filterIndex].name    // 4
      )
      
      if (result.success) {
        setScreen('success')
        setCaption('')
        setPhotoData(null)
        setFilteredPhoto(null)
        // Redireciona pro feed após 1.5s
        setTimeout(() => navigate('/feed'), 1500)
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Post error:', error)
      alert('Erro ao postar. Tenta de novo.')
    }
    
    setPosting(false)
  }

  return (
    <div className="home">
      
      {screen === 'camera' && (
        <HomeCamera onCapture={handleCapture} onClose={() => navigate('/feed')} />
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
            <div ref={filterNameRef} className={`filter-name ${filterIndex !== 0 ? 'visible' : ''}`}>
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
            <button className="action-btn secondary" onClick={handleRetake}>
              <RetakeIcon /><span>Outra</span>
            </button>
            <button className="action-btn primary" onClick={() => setScreen('caption')} disabled={!filteredPhoto}>
              <span>Continuar</span><ArrowIcon />
            </button>
          </div>
        </div>
      )}
      
      {screen === 'caption' && (
        <div className="caption-screen">
          <div className="caption-header">
            <button className="back-btn" onClick={() => setScreen('preview')}><BackIcon /></button>
            <span className="caption-title">Finalizar</span>
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
                placeholder="Escreva algo..."
                maxLength={140}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                autoFocus
              />
              <span className="caption-count">{caption.length}/140</span>
            </div>
          </div>
          
          <div className="caption-actions">
            <button className="post-btn" onClick={handlePost} disabled={posting}>
              {posting ? <div className="spinner spinner-sm" /> : <><span>Publicar</span><CheckIcon /></>}
            </button>
          </div>
        </div>
      )}
      
      {screen === 'success' && (
        <div className="success-screen">
          <div className="success-content">
            <SuccessAnimation />
            <h2 className="success-title">Publicado</h2>
            <p className="success-subtitle">Seu momento foi salvo</p>
          </div>
        </div>
      )}
    </div>
  )
}
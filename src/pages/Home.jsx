import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { uploadPost } from '../lib/posts'
import { FILTERS, applyFilter } from '../lib/filters'
import HomeCamera from './HomeCamera'
import { 
  CameraIcon, 
  RetakeIcon, 
  ArrowIcon, 
  BackIcon, 
  CheckIcon, 
  SuccessAnimation 
} from './HomeIcons'
import './Home.css'
import './preview.css'
import './caption.css'

// ==========================================
// DASEIN - Home (Orchestrator)
// ==========================================

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [screen, setScreen] = useState('home')
  const [photoData, setPhotoData] = useState(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [filteredPhoto, setFilteredPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)

  // ==========================================
  // FILTERS
  // ==========================================
  
  useEffect(() => {
    async function processFilter() {
      if (photoData && screen === 'preview') {
        const filter = FILTERS[filterIndex]
        
        if (!filter.settings) {
          setFilteredPhoto(photoData)
          return
        }
        
        const filtered = await applyFilter(photoData, filter)
        setFilteredPhoto(filtered)
      }
    }
    
    processFilter()
  }, [photoData, filterIndex, screen])

  function nextFilter() {
    if (filterIndex < FILTERS.length - 1) {
      setFilterIndex(i => i + 1)
      if (navigator.vibrate) navigator.vibrate(8)
    }
  }

  function prevFilter() {
    if (filterIndex > 0) {
      setFilterIndex(i => i - 1)
      if (navigator.vibrate) navigator.vibrate(8)
    }
  }

  // ==========================================
  // TOUCH GESTURES (Preview)
  // ==========================================

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
  }
  
  function handleTouchMove(e) {
    if (!touchState.current.isDragging) return
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchState.current.lastX
    const deltaY = Math.abs(touch.clientY - touchState.current.startY)
    const now = Date.now()
    
    if (deltaY > 80) {
      touchState.current.isDragging = false
      return
    }
    
    const threshold = 50
    const timeSinceLastChange = now - touchState.current.lastFilterChange
    
    if (timeSinceLastChange > 100) {
      if (deltaX < -threshold) {
        nextFilter()
        touchState.current.lastX = touch.clientX
        touchState.current.lastFilterChange = now
      } else if (deltaX > threshold) {
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
  }

  // ==========================================
  // HANDLERS
  // ==========================================

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
  
  async function handlePost() {
    if (posting || !filteredPhoto) return
    
    setPosting(true)
    
    try {
      // FIX: parâmetros na ordem correta
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
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Post error:', error)
      alert('Erro ao postar. Tenta de novo.')
    }
    
    setPosting(false)
  }

  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div className="home">
      
      {/* HOME SCREEN */}
      {screen === 'home' && (
        <div className="home-screen">
          <div className="home-content">
            <button className="capture-btn" onClick={() => setScreen('camera')}>
              <div className="capture-btn-ring" />
              <div className="capture-btn-icon">
                <CameraIcon />
              </div>
            </button>
            <p className="home-hint">capturar</p>
          </div>
          
          <button 
            className="home-profile-link"
            onClick={() => navigate('/profile')}
          >
            meu perfil →
          </button>
        </div>
      )}
      
      {/* CAMERA SCREEN */}
      {screen === 'camera' && (
        <HomeCamera 
          onCapture={handleCapture}
          onClose={() => setScreen('home')}
        />
      )}
      
      {/* PREVIEW SCREEN */}
      {screen === 'preview' && (
        <div className="preview-screen">
          <div 
            className="preview-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {filteredPhoto ? (
              <img src={filteredPhoto} alt="Preview" className="preview-image" />
            ) : (
              <div className="preview-loading"><div className="spinner" /></div>
            )}
            
            <div className={`filter-name ${filterIndex !== 0 ? 'visible' : ''}`}>
              {FILTERS[filterIndex].name}
            </div>
          </div>
          
          <div className="filter-indicators">
            {FILTERS.map((filter, i) => (
              <button 
                key={filter.id}
                className={`filter-dot ${i === filterIndex ? 'active' : ''}`}
                onClick={() => {
                  setFilterIndex(i)
                  if (navigator.vibrate) navigator.vibrate(5)
                }}
              />
            ))}
          </div>
          
          <div className="preview-actions">
            <button className="action-btn secondary" onClick={handleRetake}>
              <RetakeIcon /><span>Outra</span>
            </button>
            
            <button 
              className="action-btn primary"
              onClick={() => setScreen('caption')}
              disabled={!filteredPhoto}
            >
              <span>Continuar</span><ArrowIcon />
            </button>
          </div>
        </div>
      )}
      
      {/* CAPTION SCREEN */}
      {screen === 'caption' && (
        <div className="caption-screen">
          <div className="caption-header">
            <button className="back-btn" onClick={() => setScreen('preview')}>
              <BackIcon />
            </button>
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
      
      {/* SUCCESS SCREEN */}
      {screen === 'success' && (
        <div className="success-screen">
          <div className="success-content">
            <SuccessAnimation />
            <h2 className="success-title">Publicado</h2>
            <p className="success-subtitle">Seu momento foi salvo</p>
          </div>
          
          <div className="success-actions">
            <button className="action-btn primary" onClick={() => setScreen('camera')}>
              <CameraIcon /><span>Nova foto</span>
            </button>
            
            <button className="action-btn ghost" onClick={() => navigate('/profile')}>
              <span>Ver perfil</span><ArrowIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
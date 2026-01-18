import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { uploadPost } from '../lib/posts'
import { FILTERS, applyFilter } from '../lib/filters'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [screen, setScreen] = useState('home')
  const [photoData, setPhotoData] = useState(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [filteredPhoto, setFilteredPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment')
  
  // Animation states
  const [isCapturing, setIsCapturing] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [transitionPhoto, setTransitionPhoto] = useState(null)

  // ==========================================
  // CAMERA
  // ==========================================
  
  const startCamera = useCallback(async () => {
    try {
      stopCamera()
      setCameraReady(false)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1920 },
          aspectRatio: { ideal: 1 }
        },
        audio: false
      })
      
      streamRef.current = stream
      setScreen('camera')
      
      // Wait for video element
      requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().then(() => {
            // Delay ready state for smooth transition
            setTimeout(() => setCameraReady(true), 100)
          }).catch(console.error)
        }
      })
      
    } catch (error) {
      console.error('Camera error:', error)
      alert('Não foi possível acessar a câmera')
    }
  }, [facingMode])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }

  async function flipCamera() {
    if (isFlipping) return
    
    setIsFlipping(true)
    
    // Haptic
    if (navigator.vibrate) navigator.vibrate(10)
    
    // Wait for animation
    await new Promise(r => setTimeout(r, 150))
    
    stopCamera()
    setFacingMode(mode => mode === 'environment' ? 'user' : 'environment')
  }

  // Restart camera when facingMode changes
  useEffect(() => {
    if (screen === 'camera') {
      startCamera().then(() => {
        setTimeout(() => setIsFlipping(false), 300)
      })
    }
  }, [facingMode])

  // ==========================================
  // CAPTURE
  // ==========================================
  
  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current || isCapturing) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video not ready')
      return
    }
    
    // Start capture animation
    setIsCapturing(true)
    
    // Haptic - initial press
    if (navigator.vibrate) navigator.vibrate(20)
    
    // Small delay for animation feel
    setTimeout(() => {
      // Determine square crop dimensions
      const size = Math.min(video.videoWidth, video.videoHeight)
      const offsetX = (video.videoWidth - size) / 2
      const offsetY = (video.videoHeight - size) / 2
      
      canvas.width = size
      canvas.height = size
      
      // Mirror if front camera
      if (facingMode === 'user') {
        ctx.translate(size, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      } else {
        ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size)
      }
      
      // Flash
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 120)
      
      // Haptic - capture moment
      if (navigator.vibrate) navigator.vibrate([10, 30, 10])
      
      const photo = canvas.toDataURL('image/jpeg', 0.92)
      setPhotoData(photo)
      setFilteredPhoto(photo)
      setFilterIndex(0)
      setTransitionPhoto(photo)
      
      // Transition to preview
      setTimeout(() => {
        stopCamera()
        setScreen('preview')
        setIsCapturing(false)
      }, 200)
      
    }, 80)
  }

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

  // Swipe handling
  const touchState = useRef({ 
    startX: 0, 
    startY: 0,
    lastX: 0,
    startTime: 0,
    lastFilterChange: 0,
    isDragging: false
  })
  
  const SWIPE_THRESHOLD = 30
  const DRAG_THRESHOLD = 50
  const FILTER_COOLDOWN = 120
  
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
    
    if (Math.abs(deltaX) > DRAG_THRESHOLD && 
        now - touchState.current.lastFilterChange > FILTER_COOLDOWN) {
      
      if (deltaX > 0) prevFilter()
      else nextFilter()
      
      touchState.current.lastX = touch.clientX
      touchState.current.lastFilterChange = now
    }
  }
  
  function handleTouchEnd(e) {
    if (!touchState.current.isDragging) return
    touchState.current.isDragging = false
    
    const deltaX = e.changedTouches[0].clientX - touchState.current.startX
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchState.current.startY)
    const deltaTime = Date.now() - touchState.current.startTime
    
    if (deltaTime < 250 && Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < 50) {
      if (deltaX > 0) prevFilter()
      else nextFilter()
    }
  }

  // ==========================================
  // POST
  // ==========================================
  
  async function handlePost() {
    if (posting) return
    setPosting(true)
    
    const filter = FILTERS[filterIndex]
    const result = await uploadPost(user.uid, filteredPhoto || photoData, caption, filter.id)
    
    if (result.success) {
      // Haptic success
      if (navigator.vibrate) navigator.vibrate([10, 50, 10, 50, 10])
      
      setScreen('success')
      setPhotoData(null)
      setFilteredPhoto(null)
      setTransitionPhoto(null)
      setCaption('')
      setFilterIndex(0)
    } else {
      alert('Erro ao postar. Tenta de novo.')
    }
    
    setPosting(false)
  }

  function handleRetake() {
    setPhotoData(null)
    setFilteredPhoto(null)
    setTransitionPhoto(null)
    startCamera()
  }

  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div className="home">
      {/* Flash overlay */}
      <div className={`capture-flash ${showFlash ? 'active' : ''}`} />
      
      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* HOME SCREEN */}
      {screen === 'home' && (
        <div className="home-screen">
          <div className="home-content">
            <button className="capture-btn" onClick={startCamera}>
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
        <div className={`camera-screen ${cameraReady ? 'ready' : ''}`}>
          <div className={`camera-viewfinder ${isFlipping ? 'flipping' : ''}`}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={facingMode === 'user' ? 'mirror' : ''}
            />
            
            {/* Vignette overlay */}
            <div className="viewfinder-vignette" />
            
            {/* Frame guides */}
            <div className="viewfinder-frame">
              <div className="frame-corner tl" />
              <div className="frame-corner tr" />
              <div className="frame-corner bl" />
              <div className="frame-corner br" />
            </div>
          </div>
          
          {/* Controls overlay */}
          <div className="camera-controls-overlay">
            {/* Top controls */}
            <div className="camera-top-controls">
              <button 
                className="control-btn close-btn" 
                onClick={() => { stopCamera(); setScreen('home') }}
              >
                <CloseIcon />
              </button>
            </div>
            
            {/* Bottom controls */}
            <div className="camera-bottom-controls">
              <div className="controls-row">
                <div className="control-spacer" />
                
                <button 
                  className={`shutter-btn ${isCapturing ? 'capturing' : ''}`}
                  onClick={capturePhoto}
                  disabled={!cameraReady || isCapturing}
                >
                  <div className="shutter-outer">
                    <div className="shutter-ring" />
                    <div className="shutter-inner" />
                  </div>
                </button>
                
                <button 
                  className={`control-btn flip-btn ${isFlipping ? 'flipping' : ''}`}
                  onClick={flipCamera}
                  disabled={isFlipping}
                >
                  <FlipIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
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
              <img 
                src={filteredPhoto} 
                alt="Preview" 
                className="preview-image"
              />
            ) : (
              <div className="preview-loading">
                <div className="spinner" />
              </div>
            )}
            
            {/* Filter name overlay */}
            <div className={`filter-name ${filterIndex !== 0 ? 'visible' : ''}`}>
              {FILTERS[filterIndex].name}
            </div>
          </div>
          
          {/* Filter indicators */}
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
          
          {/* Bottom actions */}
          <div className="preview-actions">
            <button className="action-btn secondary" onClick={handleRetake}>
              <RetakeIcon />
              <span>Outra</span>
            </button>
            
            <button 
              className="action-btn primary"
              onClick={() => setScreen('caption')}
              disabled={!filteredPhoto}
            >
              <span>Continuar</span>
              <ArrowIcon />
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
            <button 
              className="post-btn"
              onClick={handlePost}
              disabled={posting}
            >
              {posting ? (
                <div className="spinner spinner-sm" />
              ) : (
                <>
                  <span>Publicar</span>
                  <CheckIcon />
                </>
              )}
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
            <button className="action-btn primary" onClick={startCamera}>
              <CameraIcon />
              <span>Nova foto</span>
            </button>
            
            <button 
              className="action-btn ghost"
              onClick={() => navigate('/profile')}
            >
              <span>Ver perfil</span>
              <ArrowIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// ICONS
// ==========================================

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  )
}

function FlipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H3"/>
      <path d="M18 8l3-4-3-4"/>
      <path d="M3 20h18"/>
      <path d="M6 16l-3 4 3 4"/>
      <rect x="7" y="8" width="10" height="8" rx="1"/>
    </svg>
  )
}

function RetakeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6"/>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function SuccessAnimation() {
  return (
    <div className="success-animation">
      <svg viewBox="0 0 52 52">
        <circle 
          className="success-circle"
          cx="26" cy="26" r="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        />
        <path 
          className="success-check"
          d="M14 27l8 8 16-16" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
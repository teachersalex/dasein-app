import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { uploadPost } from '../lib/posts'
import { FILTERS, applyFilter } from '../lib/filters'
import './Home.css'
import './camera.css'
import './preview.css'
import './caption.css'

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
  
  const [isCapturing, setIsCapturing] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // ==========================================
  // CAMERA
  // ==========================================
  
  const startCamera = useCallback(async () => {
    try {
      stopCamera()
      setCameraReady(false)
      setScreen('camera')
      
      // Simple constraints - no forced resolution
      const constraints = {
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      // Wait for DOM
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (videoRef.current && streamRef.current) {
        const video = videoRef.current
        video.srcObject = streamRef.current
        
        // iOS fix: proper event chain
        const handleCanPlay = () => {
          video.play()
            .then(() => setTimeout(() => setCameraReady(true), 100))
            .catch(console.error)
        }
        
        video.oncanplay = handleCanPlay
        
        // Fallback for iOS quirks
        setTimeout(() => {
          if (!cameraReady && streamRef.current) {
            video.play().catch(() => {})
            setCameraReady(true)
          }
        }, 800)
      }
      
    } catch (error) {
      console.error('Camera error:', error)
      alert('Não foi possível acessar a câmera')
      setScreen('home')
    }
  }, [facingMode])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.oncanplay = null
    }
    setCameraReady(false)
  }

  async function flipCamera() {
    if (isFlipping) return
    
    setIsFlipping(true)
    if (navigator.vibrate) navigator.vibrate(10)
    
    await new Promise(r => setTimeout(r, 150))
    
    stopCamera()
    setFacingMode(mode => mode === 'environment' ? 'user' : 'environment')
  }

  useEffect(() => {
    if (screen === 'camera') {
      startCamera().then(() => {
        setTimeout(() => setIsFlipping(false), 300)
      })
    }
    
    return () => {
      if (screen !== 'camera') stopCamera()
    }
  }, [facingMode])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  // ==========================================
  // CAPTURE - exactly what user sees
  // ==========================================
  
  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current || isCapturing || !cameraReady) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (video.videoWidth === 0 || video.videoHeight === 0) return
    
    setIsCapturing(true)
    if (navigator.vibrate) navigator.vibrate(20)
    
    setTimeout(() => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      
      const displayRect = video.getBoundingClientRect()
      const dw = displayRect.width
      const dh = displayRect.height
      
      const videoAspect = vw / vh
      const displayAspect = dw / dh
      
      let sx, sy, sw, sh
      
      if (videoAspect > displayAspect) {
        sh = vh
        sw = vh * displayAspect
        sx = (vw - sw) / 2
        sy = 0
      } else {
        sw = vw
        sh = vw / displayAspect
        sx = 0
        sy = (vh - sh) / 2
      }
      
      const outputW = Math.min(1080, sw)
      const outputH = outputW * (dh / dw)
      
      canvas.width = outputW
      canvas.height = outputH
      
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 120)
      
      if (navigator.vibrate) navigator.vibrate([10, 30, 10])
      
      const photo = canvas.toDataURL('image/jpeg', 0.92)
      setPhotoData(photo)
      setFilteredPhoto(photo)
      setFilterIndex(0)
      
      setTimeout(() => {
        stopCamera()
        setScreen('preview')
        setIsCapturing(false)
      }, 150)
      
    }, 60)
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
    
    if (Math.abs(deltaX) > 50 && now - touchState.current.lastFilterChange > 120) {
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
    
    if (deltaTime < 250 && Math.abs(deltaX) > 30 && deltaY < 50) {
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
      if (navigator.vibrate) navigator.vibrate([10, 50, 10, 50, 10])
      setScreen('success')
      setPhotoData(null)
      setFilteredPhoto(null)
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
    startCamera()
  }

  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div className="home">
      <div className={`capture-flash ${showFlash ? 'active' : ''}`} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
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
            <div className="viewfinder-vignette" />
          </div>
          
          <div className="camera-controls-overlay">
            <div className="camera-top-controls">
              <button 
                className="control-btn" 
                onClick={() => { stopCamera(); setScreen('home') }}
              >
                <CloseIcon />
              </button>
            </div>
            
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
      
      {screen === 'success' && (
        <div className="success-screen">
          <div className="success-content">
            <SuccessAnimation />
            <h2 className="success-title">Publicado</h2>
            <p className="success-subtitle">Seu momento foi salvo</p>
          </div>
          
          <div className="success-actions">
            <button className="action-btn primary" onClick={startCamera}>
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
      <path d="M21 4H3M18 8l3-4-3-4M3 20h18M6 16l-3 4 3 4"/>
      <rect x="7" y="8" width="10" height="8" rx="1"/>
    </svg>
  )
}

function RetakeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
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
        <circle className="success-circle" cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path className="success-check" d="M14 27l8 8 16-16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
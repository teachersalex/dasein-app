import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { uploadPost } from '../lib/posts'
import { FILTERS, applyFilter } from '../lib/filters'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [screen, setScreen] = useState('home') // home, camera, preview, caption, success
  const [photoData, setPhotoData] = useState(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [filteredPhoto, setFilteredPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [flashActive, setFlashActive] = useState(false)

  // ==========================================
  // CAMERA
  // ==========================================
  
  async function startCamera() {
    try {
      // Stop any existing stream first
      stopCamera()
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      
      streamRef.current = stream
      setScreen('camera')
      
      // Wait for next render cycle so videoRef is available
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().catch(console.error)
        }
      }, 50)
      
    } catch (error) {
      console.error('Camera error:', error)
      alert('Não foi possível acessar a câmera')
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  async function flipCamera() {
    stopCamera()
    setFacingMode(mode => mode === 'environment' ? 'user' : 'environment')
  }

  // Restart camera when facingMode changes
  useEffect(() => {
    if (screen === 'camera') {
      startCamera()
    }
  }, [facingMode])
  
  // Ensure video plays when component mounts with stream
  useEffect(() => {
    if (screen === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(console.error)
    }
  }, [screen])

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Check if video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video not ready')
      return
    }
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    
    ctx.drawImage(video, 0, 0)
    
    // Reset transform
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
    
    // Flash effect
    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 150)
    
    // Haptic
    if (navigator.vibrate) navigator.vibrate(15)
    
    const photo = canvas.toDataURL('image/jpeg', 0.92)
    setPhotoData(photo)
    setFilteredPhoto(photo) // Start with original
    setFilterIndex(0)
    stopCamera()
    setScreen('preview')
  }

  // ==========================================
  // FILTERS
  // ==========================================
  
  useEffect(() => {
    async function processFilter() {
      if (photoData && screen === 'preview') {
        const filter = FILTERS[filterIndex]
        
        // If original filter, just use photoData
        if (!filter.settings) {
          setFilteredPhoto(photoData)
          return
        }
        
        // Apply filter asynchronously
        const filtered = await applyFilter(photoData, filter)
        setFilteredPhoto(filtered)
      }
    }
    
    processFilter()
  }, [photoData, filterIndex, screen])

  function nextFilter() {
    setFilterIndex(i => Math.min(i + 1, FILTERS.length - 1))
  }

  function prevFilter() {
    setFilterIndex(i => Math.max(i - 1, 0))
  }

  // Swipe handling - smooth and responsive
  const touchState = useRef({ 
    startX: 0, 
    startY: 0,
    lastX: 0,
    startTime: 0,
    lastFilterChange: 0,
    isDragging: false
  })
  
  const SWIPE_THRESHOLD = 25      // Pixels to trigger filter change
  const DRAG_THRESHOLD = 60       // Pixels durante drag pra trocar
  const FILTER_COOLDOWN = 150     // ms entre trocas durante drag
  
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
    
    // Se moveu muito vertical, cancela
    if (deltaY > 100) {
      touchState.current.isDragging = false
      return
    }
    
    // Troca filtro durante drag se passou threshold e cooldown
    if (Math.abs(deltaX) > DRAG_THRESHOLD && 
        now - touchState.current.lastFilterChange > FILTER_COOLDOWN) {
      
      if (deltaX > 0) {
        prevFilter()
      } else {
        nextFilter()
      }
      
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(10)
      
      // Reset reference point
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
    
    // Swipe rápido (< 300ms) com threshold menor
    if (deltaTime < 300 && Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < 60) {
      if (deltaX > 0) {
        prevFilter()
      } else {
        nextFilter()
      }
      // Haptic
      if (navigator.vibrate) navigator.vibrate(10)
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

  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div className="home">
      {/* Flash overlay */}
      <div className={`capture-flash ${flashActive ? 'flash' : ''}`} />
      
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* HOME */}
      {screen === 'home' && (
        <div className="home-screen fade-in">
          <div className="home-content">
            <button className="capture-btn" onClick={startCamera}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
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
      
      {/* CAMERA */}
      {screen === 'camera' && (
        <div className="camera-screen fade-in">
          <div className="camera-viewfinder">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={facingMode === 'user' ? 'mirror' : ''}
            />
          </div>
          
          <div className="camera-controls">
            <button 
              className="btn-icon" 
              onClick={() => { stopCamera(); setScreen('home') }}
            >
              ✕
            </button>
            
            <button className="shutter" onClick={capturePhoto} />
            
            <button className="btn-icon" onClick={flipCamera}>
              ⟲
            </button>
          </div>
        </div>
      )}
      
      {/* PREVIEW */}
      {screen === 'preview' && (
        <div className="preview-screen fade-in">
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
              <div className="spinner" />
            )}
            <span className={`filter-label ${filterIndex !== 0 ? 'visible' : ''}`}>
              {FILTERS[filterIndex].name}
            </span>
          </div>
          
          <div 
            className="filter-indicators"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {FILTERS.map((_, i) => (
              <div 
                key={i} 
                className={`filter-bar ${i === filterIndex ? 'active' : ''}`}
                onClick={() => setFilterIndex(i)}
              />
            ))}
          </div>
          
          <div className="camera-controls">
            <button 
              className="btn btn-ghost" 
              onClick={() => { setPhotoData(null); setFilteredPhoto(null); startCamera() }}
            >
              Tirar outra
            </button>
            
            <button 
              className="btn" 
              style={{ padding: '12px 32px' }}
              onClick={() => setScreen('caption')}
              disabled={!filteredPhoto}
            >
              Avançar
            </button>
          </div>
        </div>
      )}
      
      {/* CAPTION */}
      {screen === 'caption' && (
        <div className="caption-screen fade-in">
          <div className="caption-header">
            <button className="btn btn-ghost" onClick={() => setScreen('preview')}>
              ←
            </button>
            <span className="text-heading">Escrever</span>
            <div style={{ width: 48 }} />
          </div>
          
          <div className="caption-preview">
            <img src={filteredPhoto || photoData} alt="" />
          </div>
          
          <input
            type="text"
            className="input"
            placeholder="Diga algo..."
            maxLength={140}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            autoFocus
          />
          
          <p className="text-micro" style={{ textAlign: 'right', marginTop: 8 }}>
            {caption.length}/140
          </p>
          
          <button 
            className="btn btn-full" 
            style={{ marginTop: 32 }}
            onClick={handlePost}
            disabled={posting}
          >
            {posting ? 'Postando...' : 'Postar'}
          </button>
        </div>
      )}
      
      {/* SUCCESS */}
      {screen === 'success' && (
        <div className="screen-center fade-in">
          <SuccessCheck />
          
          <h2 className="text-heading" style={{ marginBottom: 8 }}>Postado</h2>
          <p className="text-caption" style={{ marginBottom: 32 }}>Seu momento foi salvo.</p>
          
          <button className="btn" onClick={startCamera}>
            Nova foto
          </button>
          
          <button 
            className="btn btn-ghost" 
            onClick={() => navigate('/profile')}
            style={{ marginTop: 16 }}
          >
            Ver perfil →
          </button>
        </div>
      )}
    </div>
  )
}

function SuccessCheck() {
  return (
    <svg className="success-check" viewBox="0 0 52 52" style={{ width: 64, height: 64, marginBottom: 24 }}>
      <circle 
        cx="26" cy="26" r="24" 
        fill="none" 
        stroke="var(--color-success)" 
        strokeWidth="2"
        style={{
          strokeDasharray: 166,
          strokeDashoffset: 166,
          animation: 'circleDraw 0.6s ease forwards'
        }}
      />
      <path 
        d="M14 27l8 8 16-16" 
        fill="none" 
        stroke="var(--color-success)" 
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 48,
          strokeDashoffset: 48,
          animation: 'checkDraw 0.3s ease 0.4s forwards'
        }}
      />
    </svg>
  )
}
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      setScreen('camera')
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
    if (screen === 'camera' && !streamRef.current) {
      startCamera()
    }
  }, [facingMode, screen])

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
        if (filter.id === 'original' || !filter.css) {
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
    setFilterIndex(i => (i + 1) % FILTERS.length)
  }

  function prevFilter() {
    setFilterIndex(i => (i - 1 + FILTERS.length) % FILTERS.length)
  }

  // Swipe handling
  const touchStart = useRef({ x: 0, time: 0 })
  
  function handleTouchStart(e) {
    touchStart.current = { x: e.touches[0].clientX, time: Date.now() }
  }
  
  function handleTouchEnd(e) {
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x
    const deltaTime = Date.now() - touchStart.current.time
    
    if (Math.abs(deltaX) > 50 && deltaTime < 300) {
      deltaX > 0 ? prevFilter() : nextFilter()
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
        <div className="screen-center fade-in">
          <h1 className="text-title">Dasein</h1>
          <p className="text-caption" style={{ marginBottom: 48 }}>existir</p>
          
          <button className="btn" onClick={startCamera}>
            Nova foto
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/profile')}
            style={{ marginTop: 16 }}
          >
            Ver perfil
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
          
          <div className="filter-indicators">
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
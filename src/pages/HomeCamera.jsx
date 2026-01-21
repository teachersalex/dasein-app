import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { CloseIcon, FlipIcon } from './HomeIcons'
import './camera.css'

/*
 * HomeCamera — Câmera com crop 4:5
 * 
 * Contrato com Home.jsx: onCapture(base64)
 * Output: JPEG base64, aspect ratio 4:5, max 1080px
 * 
 * Correção audit: alert → toast
 */

export default function HomeCamera({ onCapture, onClose }) {
  const { showToast } = useToast()
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  
  const [facingMode, setFacingMode] = useState('environment')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // === Camera Controls ===
  
  const startCamera = useCallback(async () => {
    try {
      stopCamera()
      setCameraReady(false)
      
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
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (videoRef.current && streamRef.current) {
        const video = videoRef.current
        video.srcObject = streamRef.current
        
        const handleCanPlay = () => {
          video.play()
            .then(() => setTimeout(() => setCameraReady(true), 100))
            .catch(console.error)
        }
        
        video.oncanplay = handleCanPlay
        
        // Fallback iOS
        setTimeout(() => {
          if (!cameraReady && streamRef.current) {
            video.play().catch(() => {})
            setCameraReady(true)
          }
        }, 800)
      }
      
    } catch (error) {
      console.error('Camera error:', error)
      showToast('não foi possível acessar a câmera', 'error')
      onClose()
    }
  }, [facingMode, onClose, showToast])

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

  // Crop 4:5 e output base64 JPEG
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
      
      // Aspect ratio 4:5 — padrão Dasein
      const targetAspect = 4 / 5
      const videoAspect = vw / vh
      
      let sx, sy, sw, sh
      
      if (videoAspect > targetAspect) {
        sh = vh
        sw = vh * targetAspect
        sx = (vw - sw) / 2
        sy = 0
      } else {
        sw = vw
        sh = vw / targetAspect
        sx = 0
        sy = (vh - sh) / 2
      }
      
      const outputW = Math.min(1080, sw)
      const outputH = outputW / targetAspect
      
      canvas.width = outputW
      canvas.height = outputH
      
      // Mirror para selfie
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      
      if (facingMode === 'user') {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      
      // Flash visual
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 120)
      
      if (navigator.vibrate) navigator.vibrate([10, 30, 10])
      
      // Output: base64 JPEG
      const photo = canvas.toDataURL('image/jpeg', 0.92)
      
      setTimeout(() => {
        stopCamera()
        setIsCapturing(false)
        onCapture(photo)
      }, 150)
      
    }, 60)
  }

  // === Lifecycle ===

  useEffect(() => {
    startCamera().then(() => {
      setTimeout(() => setIsFlipping(false), 300)
    })
  }, [facingMode])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  return (
    <>
      <div className={`capture-flash ${showFlash ? 'active' : ''}`} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
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
          <div className="crop-overlay" />
        </div>
        
        <div className="camera-controls-overlay">
          <div className="camera-top-controls">
            <button className="camera-control-btn" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          
          <div className="camera-bottom-controls">
            <div className="camera-controls-row">
              <div className="camera-control-spacer" />
              
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
                className={`camera-control-btn flip-btn ${isFlipping ? 'flipping' : ''}`}
                onClick={flipCamera}
                disabled={isFlipping}
              >
                <FlipIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
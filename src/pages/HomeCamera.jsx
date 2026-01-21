import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { CloseIcon, FlipIcon, GalleryIcon } from './HomeIcons'
import './camera.css'

/*
 * HomeCamera — Câmera com crop 4:5
 * 
 * Contrato com Home.jsx: onCapture(base64)
 * Output: JPEG base64, aspect ratio 4:5, max 1080px
 * 
 * Fixes aplicados:
 * - P0: cameraReadyRef para fallback iOS (evita state stale)
 * - P0: Cleanup de todos os timeouts (evita setState em unmounted)
 * - P1: Bloqueia flip durante capture
 * - P1: Toast quando videoWidth === 0
 * - Feature: Upload da galeria
 */

export default function HomeCamera({ onCapture, onClose }) {
  const { showToast } = useToast()
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  
  // P0 Fix: refs para evitar stale closures e cleanup
  const cameraReadyRef = useRef(false)
  const timeoutsRef = useRef([])
  const mountedRef = useRef(true)
  
  const [facingMode, setFacingMode] = useState('environment')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // Sync ref com state
  useEffect(() => {
    cameraReadyRef.current = cameraReady
  }, [cameraReady])

  // Helper: timeout com cleanup automático
  const setSafeTimeout = (fn, ms) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn()
    }, ms)
    timeoutsRef.current.push(id)
    return id
  }

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  // === Camera Controls ===
  
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.oncanplay = null
      videoRef.current.onloadedmetadata = null
    }
    setCameraReady(false)
  }

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
      
      const video = videoRef.current
      if (!video || !streamRef.current) return
      
      video.srcObject = streamRef.current
      
      const markReady = async () => {
        try {
          await video.play()
          setSafeTimeout(() => setCameraReady(true), 100)
        } catch (err) {
          console.error('Video play error:', err)
        }
      }
      
      // Melhor cobertura que só oncanplay
      video.onloadedmetadata = markReady
      video.oncanplay = markReady
      
      // P0 Fix: Fallback iOS usando ref (evita state stale)
      setSafeTimeout(() => {
        if (!cameraReadyRef.current && streamRef.current) {
          video.play().catch(() => {})
          setCameraReady(true)
        }
      }, 800)
      
    } catch (error) {
      console.error('Camera error:', error)
      showToast('não foi possível acessar a câmera', 'error')
      onClose()
    }
  }, [facingMode, onClose, showToast])

  // P1 Fix: Bloqueia flip durante capture ou quando câmera não está pronta
  async function flipCamera() {
    if (isFlipping || isCapturing || !cameraReady) return
    
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
    if (!ctx) return
    
    // P1 Fix: Toast em vez de silêncio
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      showToast('câmera ainda carregando...', 'info')
      return
    }
    
    setIsCapturing(true)
    if (navigator.vibrate) navigator.vibrate(20)
    
    setSafeTimeout(() => {
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
      
      const outputW = Math.round(Math.min(1080, sw))
      const outputH = Math.round(outputW / targetAspect)
      
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
      setSafeTimeout(() => setShowFlash(false), 120)
      
      if (navigator.vibrate) navigator.vibrate([10, 30, 10])
      
      // Output: base64 JPEG
      const photo = canvas.toDataURL('image/jpeg', 0.92)
      
      setSafeTimeout(() => {
        stopCamera()
        setIsCapturing(false)
        onCapture(photo)
      }, 150)
      
    }, 60)
  }

  // === Galeria ===
  
  function openGallery() {
    if (isCapturing) return
    fileInputRef.current?.click()
  }

  async function handleGalleryPick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return

    // Validação
    if (!file.type?.startsWith('image/')) {
      showToast('arquivo inválido', 'error')
      return
    }

    try {
      setIsCapturing(true)

      // File → dataURL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Load image
      const img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = dataUrl
      })

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) throw new Error('canvas indisponível')

      // Crop 4:5 centralizado (mesma lógica da câmera)
      const iw = img.width
      const ih = img.height
      const targetAspect = 4 / 5
      const imgAspect = iw / ih

      let sx, sy, sw, sh
      if (imgAspect > targetAspect) {
        sh = ih
        sw = ih * targetAspect
        sx = (iw - sw) / 2
        sy = 0
      } else {
        sw = iw
        sh = iw / targetAspect
        sx = 0
        sy = (ih - sh) / 2
      }

      const outputW = Math.round(Math.min(1080, sw))
      const outputH = Math.round(outputW / targetAspect)

      canvas.width = outputW
      canvas.height = outputH
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputW, outputH)

      const photo = canvas.toDataURL('image/jpeg', 0.92)

      stopCamera()
      setIsCapturing(false)
      onCapture(photo)
    } catch (err) {
      console.error('Gallery pick error:', err)
      setIsCapturing(false)
      showToast('não foi possível importar a foto', 'error')
    }
  }

  // === Lifecycle ===

  useEffect(() => {
    mountedRef.current = true
    startCamera().then(() => {
      setSafeTimeout(() => setIsFlipping(false), 300)
    })

    return () => {
      mountedRef.current = false
      clearAllTimeouts()
      stopCamera()
    }
  }, [startCamera])

  return (
    <>
      <div className={`capture-flash ${showFlash ? 'active' : ''}`} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryPick}
        style={{ display: 'none' }}
      />
      
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
            <button 
              className="camera-control-btn" 
              onClick={onClose}
              disabled={isCapturing}
            >
              <CloseIcon />
            </button>
          </div>
          
          <div className="camera-bottom-controls">
            <div className="camera-controls-row">
              {/* Botão galeria no lugar do spacer */}
              <button 
                className="camera-control-btn"
                onClick={openGallery}
                disabled={isCapturing}
              >
                <GalleryIcon />
              </button>
              
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
                disabled={isFlipping || isCapturing || !cameraReady}
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

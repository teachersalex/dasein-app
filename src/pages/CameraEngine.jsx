import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { CloseIcon, FlipIcon, GalleryIcon } from '../components/Icons'
import './CameraEngine.css'

/* CameraEngine — Captura de fotos 4:5 */

const RATIO = 4 / 5
const MAX_SIZE = 1080

export default function CameraEngine({ onCapture, onClose }) {
  const { showToast } = useToast()
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const readyRef = useRef(false)
  const timeouts = useRef([])
  const mounted = useRef(true)
  
  const [facing, setFacing] = useState('environment')
  const [capturing, setCapturing] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [flash, setFlash] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => { readyRef.current = ready }, [ready])

  const timeout = (fn, ms) => {
    const id = setTimeout(() => mounted.current && fn(), ms)
    timeouts.current.push(id)
  }

  const clearTimeouts = () => { timeouts.current.forEach(clearTimeout); timeouts.current = [] }

  // Crop 4:5 centralizado
  function crop(w, h) {
    const aspect = w / h
    let sx, sy, sw, sh
    if (aspect > RATIO) { sh = h; sw = h * RATIO; sx = (w - sw) / 2; sy = 0 }
    else { sw = w; sh = w / RATIO; sx = 0; sy = (h - sh) / 2 }
    const ow = Math.round(Math.min(MAX_SIZE, sw))
    const oh = Math.round(ow / RATIO)
    return { sx, sy, sw, sh, ow, oh }
  }

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.oncanplay = null
      videoRef.current.onloadedmetadata = null
    }
    setReady(false)
  }

  const start = useCallback(async () => {
    try {
      stop()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      streamRef.current = stream
      await new Promise(r => setTimeout(r, 100))
      
      const video = videoRef.current
      if (!video || !streamRef.current) return
      video.srcObject = stream
      
      const mark = async () => {
        try { await video.play(); timeout(() => setReady(true), 100) }
        catch (e) { console.error('Play:', e) }
      }
      video.onloadedmetadata = mark
      video.oncanplay = mark
      
      // iOS fallback
      timeout(() => {
        if (!readyRef.current && streamRef.current) {
          video.play().catch(() => {})
          setReady(true)
        }
      }, 800)
    } catch (e) {
      console.error('Camera:', e)
      showToast('não foi possível acessar a câmera', 'error')
      onClose()
    }
  }, [facing, onClose, showToast])

  async function flip() {
    if (flipping || capturing || !ready) return
    setFlipping(true)
    navigator.vibrate?.(10)
    await new Promise(r => setTimeout(r, 150))
    stop()
    setFacing(f => f === 'environment' ? 'user' : 'environment')
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!video || !ctx || capturing || !ready) return
    
    if (!video.videoWidth) {
      showToast('câmera ainda carregando...', 'info')
      return
    }
    
    setCapturing(true)
    navigator.vibrate?.(20)
    
    timeout(() => {
      const { sx, sy, sw, sh, ow, oh } = crop(video.videoWidth, video.videoHeight)
      canvas.width = ow
      canvas.height = oh
      
      if (facing === 'user') { ctx.translate(ow, 0); ctx.scale(-1, 1) }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, ow, oh)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      
      setFlash(true)
      timeout(() => setFlash(false), 120)
      navigator.vibrate?.([10, 30, 10])
      
      const photo = canvas.toDataURL('image/jpeg', 0.92)
      timeout(() => { stop(); setCapturing(false); onCapture(photo) }, 150)
    }, 60)
  }

  function openGallery() { !capturing && fileRef.current?.click() }

  async function fromGallery(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file?.type?.startsWith('image/')) {
      file && showToast('arquivo inválido', 'error')
      return
    }
    
    try {
      setCapturing(true)
      
      const url = await new Promise((ok, err) => {
        const r = new FileReader()
        r.onload = () => ok(r.result)
        r.onerror = err
        r.readAsDataURL(file)
      })
      
      const img = await new Promise((ok, err) => {
        const i = new Image()
        i.onload = () => ok(i)
        i.onerror = err
        i.src = url
      })
      
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) throw new Error('canvas')
      
      const { sx, sy, sw, sh, ow, oh } = crop(img.width, img.height)
      canvas.width = ow
      canvas.height = oh
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh)
      
      stop()
      setCapturing(false)
      onCapture(canvas.toDataURL('image/jpeg', 0.92))
    } catch (e) {
      console.error('Gallery:', e)
      setCapturing(false)
      showToast('não foi possível importar', 'error')
    }
  }

  useEffect(() => {
    mounted.current = true
    start().then(() => timeout(() => setFlipping(false), 300))
    return () => { mounted.current = false; clearTimeouts(); stop() }
  }, [start])

  return (
    <>
      <div className={`capture-flash ${flash ? 'active' : ''}`} />
      <canvas ref={canvasRef} hidden />
      <input ref={fileRef} type="file" accept="image/*" onChange={fromGallery} hidden />
      
      <div className={`camera-screen ${ready ? 'ready' : ''}`}>
        <div className={`camera-viewfinder ${flipping ? 'flipping' : ''}`}>
          <video ref={videoRef} autoPlay playsInline muted className={facing === 'user' ? 'mirror' : ''} />
          <div className="viewfinder-vignette" />
          <div className="crop-overlay" />
        </div>
        
        <div className="camera-controls-overlay">
          <div className="camera-top-controls">
            <button className="camera-control-btn" onClick={onClose} disabled={capturing}>
              <CloseIcon />
            </button>
          </div>
          
          <div className="camera-bottom-controls">
            <div className="camera-controls-row">
              <button className="camera-control-btn" onClick={openGallery} disabled={capturing}>
                <GalleryIcon />
              </button>
              
              <button className={`shutter-btn ${capturing ? 'capturing' : ''}`} onClick={capture} disabled={!ready || capturing}>
                <div className="shutter-outer">
                  <div className="shutter-ring" />
                  <div className="shutter-inner" />
                </div>
              </button>
              
              <button className={`camera-control-btn flip-btn ${flipping ? 'flipping' : ''}`} onClick={flip} disabled={flipping || capturing || !ready}>
                <FlipIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { uploadPost } from '../lib/posts'
import { FILTERS, applyFilter } from '../lib/filters'
import { RetakeIcon, ArrowIcon, BackIcon, CheckIcon, SuccessAnimation } from '../components/Icons'
import CameraEngine from './CameraEngine'
import './Camera.css'

/* Camera — Fluxo: captura → preview → caption → success */

export default function Camera() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [screen, setScreen] = useState('camera')
  const [photo, setPhoto] = useState(null)
  const [filterIdx, setFilterIdx] = useState(0)
  const [filtered, setFiltered] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)

  const nameRef = useRef(null)
  const redirectRef = useRef(null)
  const touch = useRef({ startX: 0, startY: 0, lastX: 0, startTime: 0, lastChange: 0, dragging: false })

  useEffect(() => () => redirectRef.current && clearTimeout(redirectRef.current), [])

  // Aplicar filtro
  useEffect(() => {
    if (!photo || screen !== 'preview') return
    let cancelled = false
    
    const filter = FILTERS[filterIdx]
    if (!filter.settings) { setFiltered(photo); return }
    
    applyFilter(photo, filter).then(result => !cancelled && setFiltered(result))
    return () => { cancelled = true }
  }, [photo, filterIdx, screen])

  // Navegação de filtro
  const next = () => filterIdx < FILTERS.length - 1 && (setFilterIdx(i => i + 1), navigator.vibrate?.(10))
  const prev = () => filterIdx > 0 && (setFilterIdx(i => i - 1), navigator.vibrate?.(10))

  function onTouchStart(e) {
    const t = e.touches[0]
    touch.current = { startX: t.clientX, startY: t.clientY, lastX: t.clientX, startTime: Date.now(), lastChange: Date.now(), dragging: true }
    if (nameRef.current) nameRef.current.style.transition = 'none'
  }
  
  function onTouchMove(e) {
    if (!touch.current.dragging) return
    const t = e.touches[0]
    const dx = t.clientX - touch.current.startX
    const dLast = t.clientX - touch.current.lastX
    const dy = Math.abs(t.clientY - touch.current.startY)
    
    if (dy > 80) { touch.current.dragging = false; resetName(); return }
    
    if (nameRef.current) {
      nameRef.current.style.transform = `translateX(${dx * 0.6}px)`
      nameRef.current.style.opacity = 1 - Math.abs(dx) / 250
    }
    
    const now = Date.now()
    if (now - touch.current.lastChange > 100) {
      if (dLast < -50) { next(); touch.current.lastX = t.clientX; touch.current.lastChange = now }
      else if (dLast > 50) { prev(); touch.current.lastX = t.clientX; touch.current.lastChange = now }
    }
  }
  
  function onTouchEnd(e) {
    if (!touch.current.dragging) return
    const dur = Date.now() - touch.current.startTime
    const dx = e.changedTouches[0].clientX - touch.current.startX
    if (dur < 200 && Math.abs(dx) > 30) dx < 0 ? next() : prev()
    touch.current.dragging = false
    resetName(true)
  }
  
  function resetName(animate) {
    if (nameRef.current) {
      nameRef.current.style.transition = animate ? 'transform .3s, opacity .3s' : 'none'
      nameRef.current.style.transform = 'translateX(0)'
      nameRef.current.style.opacity = filterIdx !== 0 ? '1' : '0'
    }
  }

  // Handlers
  function onCapture(data) {
    setPhoto(data)
    setFiltered(data)
    setFilterIdx(0)
    setScreen('preview')
  }

  function retake() {
    setPhoto(null)
    setFiltered(null)
    setScreen('camera')
  }
  
  async function post() {
    if (posting || !filtered) return
    if (!user?.uid) { showToast('faça login para publicar', 'error'); return }
    
    setPosting(true)
    try {
      const result = await uploadPost(user.uid, filtered, caption, FILTERS[filterIdx].name)
      if (result.success) {
        setScreen('success')
        setCaption('')
        setPhoto(null)
        setFiltered(null)
        redirectRef.current = setTimeout(() => navigate('/feed'), 1500)
      } else throw new Error(result.error)
    } catch (e) {
      console.error('Post:', e)
      showToast('erro ao publicar', 'error')
    }
    setPosting(false)
  }

  return (
    <div className="camera-flow">
      {screen === 'camera' && <CameraEngine onCapture={onCapture} onClose={() => navigate('/feed')} />}
      
      {screen === 'preview' && (
        <div className="preview-screen">
          <div className="preview-container">
            {filtered ? <img src={filtered} alt="" className="preview-image" /> : <div className="preview-loading"><div className="spinner" /></div>}
          </div>
          
          <div className="filter-controls">
            <div ref={nameRef} className={`filter-name ${filterIdx !== 0 ? 'visible' : ''}`}>{FILTERS[filterIdx].name}</div>
            <div className="filter-indicators" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              {FILTERS.map((f, i) => (
                <button key={f.id} className={`filter-bar ${i === filterIdx ? 'active' : ''}`} onClick={() => { setFilterIdx(i); navigator.vibrate?.(5) }} />
              ))}
            </div>
          </div>
          
          <div className="preview-actions">
            <button className="preview-btn secondary" onClick={retake}><RetakeIcon /><span>outra</span></button>
            <button className="preview-btn primary" onClick={() => setScreen('caption')} disabled={!filtered}><span>continuar</span><ArrowIcon /></button>
          </div>
        </div>
      )}
      
      {screen === 'caption' && (
        <div className="caption-screen">
          <div className="caption-header">
            <button className="caption-back" onClick={() => setScreen('preview')}><BackIcon /></button>
            <span className="caption-title">finalizar</span>
            <div style={{ width: 44 }} />
          </div>
          
          <div className="caption-content">
            <div className="caption-preview"><img src={filtered || photo} alt="" /></div>
            <div className="caption-input-wrapper">
              <input type="text" className="caption-input" placeholder="escreva algo..." maxLength={140} value={caption} onChange={e => setCaption(e.target.value)} autoFocus />
              <span className="caption-count">{caption.length}/140</span>
            </div>
          </div>
          
          <div className="caption-actions">
            <button className="caption-post-btn" onClick={post} disabled={posting}>
              {posting ? <div className="spinner spinner-sm" /> : <><span>publicar</span><CheckIcon /></>}
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

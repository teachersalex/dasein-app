import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../hooks/useAuth'
import { storage } from '../lib/firebase'
import { validateInviteCode, useInvite } from '../lib/invites'
import { resizeImage } from '../lib/utils'
import './Landing.css'

/*
 * Landing — Jornada completa de entrada no Dasein
 * 
 * Estados:
 * - landing: contemplação inicial
 * - code: campo de código (se não veio por URL)
 * - signup: criar conta (email + senha)
 * - profile: username + avatar
 * - login: para quem já tem conta
 * 
 * Filosofia: a landing não termina, ela se transforma.
 */

export default function Landing() {
  const navigate = useNavigate()
  const { inviteCode: urlCode } = useParams()
  const { 
    user, 
    profile,
    signupWithEmail, 
    loginWithEmail,
    createUserProfile, 
    isUsernameTaken, 
    getUserProfile, 
    setProfile 
  } = useAuth()
  
  // === State ===
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState('landing')
  const [transitioning, setTransitioning] = useState(false)
  
  // Invite
  const [code, setCode] = useState('')
  const [inviteData, setInviteData] = useState(null)
  const [pendingUrlCode, setPendingUrlCode] = useState(null)
  
  // Auth
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authUser, setAuthUser] = useState(null)
  
  // Profile
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState({ text: '', valid: null })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  
  // UI
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Refs
  const usernameTimeoutRef = useRef(null)
  const codeInputRef = useRef(null)
  const emailInputRef = useRef(null)

  // === Effects ===
  
  // Mount animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Capture invite code from URL - ACEITA QUALQUER FORMATO
  useEffect(() => {
    if (urlCode) {
      // Remove prefixo DSEIN ou DSEIN- se existir, pega só os 5 chars
      const cleanCode = urlCode.toUpperCase().replace(/^DSEIN-?/i, '').slice(0, 5)
      if (cleanCode.match(/^[A-Z0-9]{5}$/)) {
        setPendingUrlCode(`DSEIN-${cleanCode}`)
      }
    }
  }, [urlCode])

  // Redirect if already logged in with profile
  useEffect(() => {
    if (user && profile) {
      navigate('/feed', { replace: true })
    }
  }, [user, profile, navigate])

  // Focus inputs on step change
  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      setTimeout(() => codeInputRef.current?.focus(), 400)
    }
    if ((step === 'signup' || step === 'login') && emailInputRef.current) {
      setTimeout(() => emailInputRef.current?.focus(), 400)
    }
  }, [step])

  // === Transitions ===
  
  function transitionTo(newStep) {
    setTransitioning(true)
    setError('')
    
    setTimeout(() => {
      setStep(newStep)
      setTransitioning(false)
    }, 300)
  }

  // === Handlers: Landing ===
  
  async function handleInviteClick() {
    if (pendingUrlCode) {
      // Código veio pela URL — validar automaticamente
      setLoading(true)
      const result = await validateInviteCode(pendingUrlCode)
      
      if (result.valid) {
        setInviteData(result.invite)
        setCode(pendingUrlCode)
        transitionTo('signup')
      } else {
        setError(result.error)
        transitionTo('code')
      }
      setLoading(false)
    } else {
      // Sem código na URL — mostrar campo
      transitionTo('code')
    }
  }

  function handleLoginClick() {
    transitionTo('login')
  }

  // === Handlers: Code ===
  
  function handleCodeChange(e) {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    
    // Limit to 5 characters (the code part only)
    if (value.length > 5) {
      value = value.slice(0, 5)
    }
    
    setCode(value)
    setError('')
  }

  async function handleCodeSubmit(e) {
    e?.preventDefault()
    
    const normalizedCode = `DSEIN-${code}`
    
    if (!normalizedCode.match(/^DSEIN-[A-Z0-9]{5}$/)) {
      setError('Código inválido')
      return
    }
    
    setLoading(true)
    const result = await validateInviteCode(normalizedCode)
    
    if (result.valid) {
      setInviteData(result.invite)
      setCode(normalizedCode)
      transitionTo('signup')
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  // === Handlers: Signup ===
  
  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const result = await signupWithEmail(email, password)
    
    if (result.success) {
      setAuthUser(result.user)
      await useInvite(code, result.user.uid)
      transitionTo('profile')
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  // === Handlers: Login ===
  
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const result = await loginWithEmail(email, password)
    
    if (result.success) {
      const existingProfile = await getUserProfile(result.user.uid)
      
      if (existingProfile) {
        setProfile(existingProfile)
        navigate('/feed')
      } else {
        // Tem auth mas não tem profile — ir pro onboarding
        setAuthUser(result.user)
        transitionTo('profile')
      }
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  // === Handlers: Profile ===
  
  function handleUsernameChange(e) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    
    // Clear previous timeout
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current)
    }
    
    if (value.length >= 3) {
      setUsernameStatus({ text: 'verificando...', valid: null })
      
      usernameTimeoutRef.current = setTimeout(async () => {
        const taken = await isUsernameTaken(value)
        if (taken) {
          setUsernameStatus({ text: 'indisponível', valid: false })
        } else {
          setUsernameStatus({ text: 'disponível', valid: true })
        }
      }, 500)
    } else if (value.length > 0) {
      setUsernameStatus({ text: 'mínimo 3 caracteres', valid: false })
    } else {
      setUsernameStatus({ text: '', valid: null })
    }
  }

  function handleAvatarSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 🔧 FIX: Usa resizeImage do utils
    resizeImage(file, 400, (resizedBlob) => {
      setAvatarFile(resizedBlob)
      
      const reader = new FileReader()
      reader.onload = (e) => setAvatarPreview(e.target.result)
      reader.readAsDataURL(resizedBlob)
    })
  }

  async function handleProfileSubmit(e) {
    e.preventDefault()
    
    if (username.length < 3 || usernameStatus.valid === false) {
      setError('Username inválido')
      return
    }
    
    // Double-check availability
    const taken = await isUsernameTaken(username)
    if (taken) {
      setUsernameStatus({ text: 'indisponível', valid: false })
      return
    }
    
    setLoading(true)
    
    let photoURL = null
    if (avatarFile) {
      try {
        const avatarRef = ref(storage, `avatars/${authUser.uid}.jpg`)
        await uploadBytes(avatarRef, avatarFile)
        photoURL = await getDownloadURL(avatarRef)
      } catch (err) {
        console.error('Avatar upload failed:', err)
      }
    }
    
    const result = await createUserProfile(authUser.uid, {
      displayName: displayName || username,
      username,
      email: authUser.email,
      photoURL,
      invitedBy: inviteData?.createdBy || null
    })
    
    if (result.success) {
      const newProfile = await getUserProfile(authUser.uid)
      if (newProfile) {
        setProfile(newProfile)
      }
      navigate('/feed')
    } else {
      setError(result.error || 'Erro ao criar perfil')
    }
    
    setLoading(false)
  }

  // === Helpers ===
  
  // 🔧 FIX: resizeImage removido — agora importado de utils.js

  function handleBack() {
    setError('')
    if (step === 'code' || step === 'login') {
      transitionTo('landing')
    } else if (step === 'signup') {
      transitionTo('code')
    }
  }

  // === Computed ===
  
  const isCodeComplete = code.length === 5
  const canSubmitProfile = username.length >= 3 && usernameStatus.valid === true

  // === Render ===
  
  return (
    <div className={`landing ${mounted ? 'mounted' : ''} ${step !== 'landing' ? 'transformed' : ''}`}>
      <div className="landing-bg" />
      <div className="landing-gradient" />
      
      <div className={`landing-content ${transitioning ? 'transitioning' : ''}`}>
        
        {/* === Landing State === */}
        {step === 'landing' && (
          <>
            <h1 className="landing-logo">Dasein</h1>
            
            <div className="marquee-container">
              <div className="marquee">
                <div className="marquee-text">
                  <span>guarde seus momentos</span>
                  <span className="separator" />
                  <span>mostre seu estilo</span>
                  <span className="separator" />
                  <span>conte suas histórias</span>
                  <span className="separator" />
                  <span>keep your moments</span>
                  <span className="separator" />
                  <span>show your style</span>
                  <span className="separator" />
                  <span>tell your stories</span>
                  <span className="separator" />
                </div>
                <div className="marquee-text">
                  <span>guarde seus momentos</span>
                  <span className="separator" />
                  <span>mostre seu estilo</span>
                  <span className="separator" />
                  <span>conte suas histórias</span>
                  <span className="separator" />
                  <span>keep your moments</span>
                  <span className="separator" />
                  <span>show your style</span>
                  <span className="separator" />
                  <span>tell your stories</span>
                  <span className="separator" />
                </div>
              </div>
            </div>
            
            <div className="landing-actions">
              <button 
                className="landing-invite" 
                onClick={handleInviteClick}
                disabled={loading}
              >
                {loading ? 'validando...' : 'tenho um convite'}
              </button>
              
              <button className="landing-link" onClick={handleLoginClick}>
                já tenho conta
              </button>
            </div>
            
            {error && <p className="landing-error">{error}</p>}
          </>
        )}

        {/* === Code State === */}
        {step === 'code' && (
          <div className="landing-form">
            <button className="landing-back" onClick={handleBack}>
              ← voltar
            </button>
            
            <h1 className="landing-logo small">Dasein</h1>
            <p className="landing-subtitle">digite seu código</p>
            
            <form onSubmit={handleCodeSubmit}>
              <input
                ref={codeInputRef}
                type="text"
                className="landing-input code"
                placeholder="XXXXX"
                value={code}
                onChange={handleCodeChange}
                maxLength={5}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
              />
              
              {error && <p className="landing-error">{error}</p>}
              
              <button 
                type="submit" 
                className="landing-button"
                disabled={!isCodeComplete || loading}
              >
                {loading ? 'validando...' : 'continuar'}
              </button>
            </form>
          </div>
        )}

        {/* === Signup State === */}
        {step === 'signup' && (
          <div className="landing-form">
            <h1 className="landing-logo small">Dasein</h1>
            <p className="landing-subtitle">criar conta</p>
            
            <form onSubmit={handleSignup}>
              <div className="landing-field">
                <label>email</label>
                <input
                  ref={emailInputRef}
                  type="email"
                  className="landing-input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              
              <div className="landing-field">
                <label>senha</label>
                <input
                  type="password"
                  className="landing-input"
                  placeholder="mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              
              {error && <p className="landing-error">{error}</p>}
              
              <button 
                type="submit" 
                className="landing-button"
                disabled={loading || !email || password.length < 6}
              >
                {loading ? 'criando...' : 'criar conta'}
              </button>
            </form>
          </div>
        )}

        {/* === Profile State === */}
        {step === 'profile' && (
          <div className="landing-form">
            <h1 className="landing-logo small">Dasein</h1>
            <p className="landing-subtitle">seu perfil</p>
            
            <form onSubmit={handleProfileSubmit}>
              <label className="landing-avatar">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" />
                ) : (
                  <CameraIcon />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                />
              </label>
              <p className="landing-avatar-hint">
                {avatarPreview ? (
                  <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}>
                    remover foto
                  </button>
                ) : (
                  'toque para adicionar foto'
                )}
              </p>
              
              <div className="landing-field">
                <label>nome</label>
                <input
                  type="text"
                  className="landing-input"
                  placeholder="como quer ser chamado"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              
              <div className="landing-field">
                <label>username</label>
                <div className="landing-username-wrap">
                  <span className="landing-username-at">@</span>
                  <input
                    type="text"
                    className="landing-input username"
                    placeholder="username"
                    value={username}
                    onChange={handleUsernameChange}
                    required
                    minLength={3}
                    autoComplete="username"
                  />
                </div>
                {usernameStatus.text && (
                  <span className={`landing-field-status ${usernameStatus.valid === true ? 'valid' : usernameStatus.valid === false ? 'invalid' : ''}`}>
                    {usernameStatus.text}
                  </span>
                )}
              </div>
              
              {error && <p className="landing-error">{error}</p>}
              
              <button 
                type="submit" 
                className="landing-button"
                disabled={loading || !canSubmitProfile}
              >
                {loading ? 'finalizando...' : 'começar'}
              </button>
            </form>
          </div>
        )}

        {/* === Login State === */}
        {step === 'login' && (
          <div className="landing-form">
            <button className="landing-back" onClick={handleBack}>
              ← voltar
            </button>
            
            <h1 className="landing-logo small">Dasein</h1>
            <p className="landing-subtitle">entrar</p>
            
            <form onSubmit={handleLogin}>
              <div className="landing-field">
                <label>email</label>
                <input
                  ref={emailInputRef}
                  type="email"
                  className="landing-input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              
              <div className="landing-field">
                <label>senha</label>
                <input
                  type="password"
                  className="landing-input"
                  placeholder="sua senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              
              {error && <p className="landing-error">{error}</p>}
              
              <button 
                type="submit" 
                className="landing-button"
                disabled={loading || !email || !password}
              >
                {loading ? 'entrando...' : 'entrar'}
              </button>
            </form>
          </div>
        )}
        
      </div>
    </div>
  )
}

// === Icons ===

function CameraIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
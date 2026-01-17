import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../hooks/useAuth'
import { storage } from '../lib/firebase'
import { validateInviteCode, useInvite } from '../lib/invites'
import './Auth.css'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, signupWithEmail, loginWithGoogle, createUserProfile, isUsernameTaken } = useAuth()
  
  const [step, setStep] = useState('code') // code, signup, onboarding
  const [inviteCode, setInviteCode] = useState('')
  const [inviteData, setInviteData] = useState(null)
  const [authUser, setAuthUser] = useState(null)
  
  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState({ text: '', color: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if came from redirect
  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (stepParam === 'onboarding' && user) {
      setAuthUser(user)
      setStep('onboarding')
    }
  }, [searchParams, user])

  // ==========================================
  // STEP 1: Code validation
  // ==========================================
  
  function handleCodeInput(e) {
    let value = e.target.value.toUpperCase()
    if (value.length === 5 && !value.includes('-')) {
      value = value + '-'
    }
    setInviteCode(value)
    setError('')
  }

  async function handleValidateCode() {
    setLoading(true)
    setError('')
    
    const result = await validateInviteCode(inviteCode)
    
    if (result.valid) {
      setInviteData(result.invite)
      setStep('signup')
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  // ==========================================
  // STEP 2: Signup
  // ==========================================
  
  async function handleGoogleSignup() {
    setLoading(true)
    setError('')
    
    const result = await loginWithGoogle()
    
    if (result.success) {
      setAuthUser(result.user)
      
      // Check if already has profile
      const { getUserProfile } = useAuth()
      const profile = await getUserProfile(result.user.uid)
      
      if (profile) {
        navigate('/home')
      } else {
        await useInvite(inviteCode, result.user.uid)
        setDisplayName(result.user.displayName || '')
        setStep('onboarding')
      }
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  async function handleEmailSignup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const result = await signupWithEmail(email, password)
    
    if (result.success) {
      setAuthUser(result.user)
      await useInvite(inviteCode, result.user.uid)
      setStep('onboarding')
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  // ==========================================
  // STEP 3: Onboarding
  // ==========================================
  
  function handleUsernameInput(e) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    
    if (value.length >= 3) {
      setUsernameStatus({ text: 'Verificando...', color: 'var(--color-text-tertiary)' })
      
      // Debounce
      clearTimeout(window.usernameTimeout)
      window.usernameTimeout = setTimeout(async () => {
        const taken = await isUsernameTaken(value)
        if (taken) {
          setUsernameStatus({ text: 'Username já em uso', color: 'var(--color-error)' })
        } else {
          setUsernameStatus({ text: 'Disponível ✓', color: 'var(--color-success)' })
        }
      }, 500)
    } else {
      setUsernameStatus({ text: '', color: '' })
    }
  }

  function handleAvatarSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    
    setAvatarFile(file)
    
    const reader = new FileReader()
    reader.onload = (e) => setAvatarPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  async function handleOnboarding(e) {
    e.preventDefault()
    
    if (username.length < 3) {
      setUsernameStatus({ text: 'Username muito curto', color: 'var(--color-error)' })
      return
    }
    
    const taken = await isUsernameTaken(username)
    if (taken) {
      setUsernameStatus({ text: 'Username já em uso', color: 'var(--color-error)' })
      return
    }
    
    setLoading(true)
    
    // Upload avatar
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
    
    // Create profile
    const result = await createUserProfile(authUser.uid, {
      displayName,
      username,
      email: authUser.email,
      photoURL,
      invitedBy: inviteData?.createdBy || null
    })
    
    if (result.success) {
      navigate('/home')
    } else {
      setError(result.error || 'Erro ao criar perfil')
    }
    
    setLoading(false)
  }

  const isCodeValid = inviteCode.match(/^DSEIN-[A-Z0-9]{5}$/)

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" className="auth-back">← voltar</Link>
      </header>
      
      {/* STEP 1: Code */}
      <div className={`auth-step ${step === 'code' ? 'active' : ''}`}>
        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">Digite seu código de convite</p>
        
        <div className="auth-spacer" />
        
        <div className="field">
          <input
            type="text"
            className="input code-input"
            placeholder="DSEIN-XXXXX"
            value={inviteCode}
            onChange={handleCodeInput}
            maxLength={11}
          />
        </div>
        
        {error && <p className="auth-error">{error}</p>}
        
        {loading && (
          <div className="auth-loading">
            <div className="spinner spinner-sm" />
            <span>Validando...</span>
          </div>
        )}
        
        <button
          className="btn btn-full"
          onClick={handleValidateCode}
          disabled={!isCodeValid || loading}
        >
          Continuar
        </button>
      </div>
      
      {/* STEP 2: Signup */}
      <div className={`auth-step ${step === 'signup' ? 'active' : ''}`}>
        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">Bem-vindo ao Dasein</p>
        
        <div className="auth-spacer" />
        
        <button 
          className="btn btn-google btn-full" 
          onClick={handleGoogleSignup}
          disabled={loading}
        >
          <GoogleIcon />
          Continuar com Google
        </button>
        
        <div className="divider">
          <span>ou</span>
        </div>
        
        <form onSubmit={handleEmailSignup}>
          <div className="field">
            <label className="field-label">EMAIL</label>
            <input
              type="email"
              className="input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="field">
            <label className="field-label">SENHA</label>
            <input
              type="password"
              className="input"
              placeholder="mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          
          {error && <p className="auth-error">{error}</p>}
          
          {loading && (
            <div className="auth-loading">
              <div className="spinner spinner-sm" />
              <span>Criando conta...</span>
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-full"
            disabled={loading}
          >
            Criar conta
          </button>
        </form>
      </div>
      
      {/* STEP 3: Onboarding */}
      <div className={`auth-step ${step === 'onboarding' ? 'active' : ''}`}>
        <h1 className="auth-title">Seu perfil</h1>
        <p className="auth-subtitle">Como quer ser chamado?</p>
        
        <div className="auth-spacer" />
        
        <label className="avatar-upload">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" />
          ) : (
            <CameraIcon />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            style={{ display: 'none' }}
          />
        </label>
        
        <p className="avatar-upload-hint">
          Toque para adicionar foto · <a href="#" onClick={(e) => { e.preventDefault(); setAvatarFile(null); setAvatarPreview(null) }}>pular</a>
        </p>
        
        <form onSubmit={handleOnboarding}>
          <div className="field">
            <label className="field-label">NOME</label>
            <input
              type="text"
              className="input"
              placeholder="Seu nome"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          </div>
          
          <div className="field">
            <label className="field-label">USERNAME</label>
            <div className="username-wrapper">
              <span className="username-prefix">@</span>
              <input
                type="text"
                className="input"
                placeholder="username"
                value={username}
                onChange={handleUsernameInput}
                required
                minLength={3}
              />
            </div>
            {usernameStatus.text && (
              <p className="field-hint" style={{ color: usernameStatus.color }}>
                {usernameStatus.text}
              </p>
            )}
          </div>
          
          {error && <p className="auth-error">{error}</p>}
          
          {loading && (
            <div className="auth-loading">
              <div className="spinner spinner-sm" />
              <span>Finalizando...</span>
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-full"
            disabled={loading || username.length < 3}
          >
            Começar
          </button>
        </form>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

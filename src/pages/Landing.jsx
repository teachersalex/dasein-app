import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../hooks/useAuth'
import { storage } from '../lib/firebase'
import { validateInviteCode, useInvite } from '../lib/invites'
import { resizeImage } from '../lib/utils'
import { HeroStep, CodeStep, SignupStep, LoginStep, ProfileStep } from '../components/LandingSteps'
import './Landing.css'

/*
 * Landing — Orquestra a jornada de entrada no Dasein
 * 
 * Steps: landing → code → signup → profile
 *        landing → login → (profile se não tiver)
 * 
 * Visual dos steps está em LandingSteps.jsx
 */

export default function Landing() {
  const navigate = useNavigate()
  const { inviteCode: urlCode } = useParams()
  const { 
    user, profile, signupWithEmail, loginWithEmail,
    createUserProfile, isUsernameTaken, getUserProfile, setProfile, logout
  } = useAuth()
  
  // UI State
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState('landing')
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Code State
  const [codePart, setCodePart] = useState('')
  const [fullCode, setFullCode] = useState('')
  const [inviteData, setInviteData] = useState(null)
  const [pendingUrlCode, setPendingUrlCode] = useState(null)
  
  // Auth State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authUser, setAuthUser] = useState(null)
  
  // Profile State
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState({ text: '', valid: null })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  
  // Refs
  const usernameTimeoutRef = useRef(null)
  const codeInputRef = useRef(null)
  const emailInputRef = useRef(null)

  // === Effects ===
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    return () => {
      if (usernameTimeoutRef.current) clearTimeout(usernameTimeoutRef.current)
    }
  }, [])

  // Parse invite code from URL
  useEffect(() => {
    if (!urlCode) return
    
    const upper = urlCode.toUpperCase()
    let cleanCode = ''
    
    if (upper.startsWith('DSEIN-')) {
      cleanCode = upper.slice(6, 11)
    } else if (upper.startsWith('DSEIN')) {
      cleanCode = upper.slice(5, 10)
    } else if (upper.length === 5) {
      cleanCode = upper
    } else {
      cleanCode = upper.replace(/[^A-Z0-9]/g, '').slice(-5)
    }
    
    if (cleanCode.length === 5 && /^[A-Z0-9]{5}$/.test(cleanCode)) {
      setPendingUrlCode(`DSEIN-${cleanCode}`)
    }
  }, [urlCode])

  // Redirect if logged in
  useEffect(() => {
    if (user && profile) {
      navigate('/feed', { replace: true })
    }
  }, [user, profile, navigate])

  // Focus inputs on step change
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 400)
    }
    if (step === 'signup' || step === 'login') {
      setTimeout(() => emailInputRef.current?.focus(), 400)
    }
  }, [step])

  // === Helpers ===
  
  function transitionTo(newStep) {
    setTransitioning(true)
    setError('')
    setTimeout(() => {
      setStep(newStep)
      setTransitioning(false)
    }, 300)
  }

  function handleBack() {
    setError('')
    if (step === 'code' || step === 'login') {
      transitionTo('landing')
    } else if (step === 'signup') {
      transitionTo('code')
    }
  }

  // === Handlers: Hero ===
  
  async function handleInviteClick() {
    if (pendingUrlCode) {
      setLoading(true)
      setError('')
      
      const result = await validateInviteCode(pendingUrlCode)
      
      if (result.valid) {
        setInviteData(result.invite)
        setFullCode(pendingUrlCode)
        transitionTo('signup')
      } else {
        setError(result.error)
        setCodePart(pendingUrlCode.replace(/^DSEIN-/, ''))
        transitionTo('code')
      }
      setLoading(false)
    } else {
      transitionTo('code')
    }
  }

  // === Handlers: Code ===
  
  function handleCodeChange(e) {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (value.length > 5) value = value.slice(0, 5)
    setCodePart(value)
    setError('')
  }

  async function handleCodeSubmit(e) {
    e?.preventDefault()
    
    if (codePart.length !== 5) {
      setError('Código deve ter 5 caracteres')
      return
    }
    
    const normalizedCode = `DSEIN-${codePart}`
    setLoading(true)
    
    const result = await validateInviteCode(normalizedCode)
    
    if (result.valid) {
      setInviteData(result.invite)
      setFullCode(normalizedCode)
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
    
    const authResult = await signupWithEmail(email, password)
    
    if (!authResult.success) {
      setError(authResult.error)
      setLoading(false)
      return
    }
    
    const inviteResult = await useInvite(fullCode, authResult.user.uid)
    
    if (inviteResult.success) {
      setAuthUser(authResult.user)
      transitionTo('profile')
    } else {
      setError(inviteResult.error || 'Erro ao usar convite. Tente novamente.')
      await logout()
    }
    
    setLoading(false)
  }

  // === Handlers: Login ===
  
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const result = await loginWithEmail(email, password)
    
    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }
    
    const existingProfile = await getUserProfile(result.user.uid)
    
    if (existingProfile) {
      setProfile(existingProfile)
      navigate('/feed')
    } else {
      setAuthUser(result.user)
      transitionTo('profile')
    }
    
    setLoading(false)
  }

  // === Handlers: Profile ===
  
  function handleUsernameChange(e) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    
    if (usernameTimeoutRef.current) clearTimeout(usernameTimeoutRef.current)
    
    if (value.length >= 3) {
      setUsernameStatus({ text: 'verificando...', valid: null })
      usernameTimeoutRef.current = setTimeout(async () => {
        const taken = await isUsernameTaken(value)
        setUsernameStatus(taken 
          ? { text: 'indisponível', valid: false }
          : { text: 'disponível', valid: true }
        )
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
    
    const taken = await isUsernameTaken(username)
    if (taken) {
      setUsernameStatus({ text: 'indisponível', valid: false })
      return
    }
    
    setLoading(true)
    
    const currentUser = authUser || user
    
    if (!currentUser) {
      setError('Sessão expirada. Tente novamente.')
      setLoading(false)
      transitionTo('landing')
      return
    }
    
    let photoURL = null
    if (avatarFile) {
      try {
        const avatarRef = ref(storage, `avatars/${currentUser.uid}.jpg`)
        await uploadBytes(avatarRef, avatarFile)
        photoURL = await getDownloadURL(avatarRef)
      } catch (err) {
        console.error('Avatar upload failed:', err)
      }
    }
    
    const result = await createUserProfile(currentUser.uid, {
      displayName: displayName || username,
      username,
      email: currentUser.email,
      photoURL,
      invitedBy: inviteData?.createdBy || null
    })
    
    if (result.success) {
      const newProfile = await getUserProfile(currentUser.uid)
      if (newProfile) setProfile(newProfile)
      navigate('/feed')
    } else {
      setError(result.error || 'Erro ao criar perfil')
    }
    
    setLoading(false)
  }

  // === Render ===
  
  return (
    <div className={`landing ${mounted ? 'mounted' : ''} ${step !== 'landing' ? 'transformed' : ''}`}>
      <div className="landing-bg" />
      <div className="landing-gradient" />
      
      <div className={`landing-content ${transitioning ? 'transitioning' : ''}`}>
        
        {step === 'landing' && (
          <HeroStep 
            onInvite={handleInviteClick}
            onLogin={() => transitionTo('login')}
            loading={loading}
            error={error}
          />
        )}

        {step === 'code' && (
          <CodeStep 
            code={codePart}
            onChange={handleCodeChange}
            onSubmit={handleCodeSubmit}
            onBack={handleBack}
            loading={loading}
            error={error}
            inputRef={codeInputRef}
          />
        )}

        {step === 'signup' && (
          <SignupStep 
            email={email}
            password={password}
            onEmailChange={e => setEmail(e.target.value)}
            onPasswordChange={e => setPassword(e.target.value)}
            onSubmit={handleSignup}
            loading={loading}
            error={error}
            inputRef={emailInputRef}
          />
        )}

        {step === 'profile' && (
          <ProfileStep 
            displayName={displayName}
            username={username}
            usernameStatus={usernameStatus}
            avatarPreview={avatarPreview}
            onDisplayNameChange={e => setDisplayName(e.target.value)}
            onUsernameChange={handleUsernameChange}
            onAvatarSelect={handleAvatarSelect}
            onAvatarRemove={() => { setAvatarFile(null); setAvatarPreview(null) }}
            onSubmit={handleProfileSubmit}
            loading={loading}
            error={error}
          />
        )}

        {step === 'login' && (
          <LoginStep 
            email={email}
            password={password}
            onEmailChange={e => setEmail(e.target.value)}
            onPasswordChange={e => setPassword(e.target.value)}
            onSubmit={handleLogin}
            onBack={handleBack}
            loading={loading}
            error={error}
            inputRef={emailInputRef}
          />
        )}
        
      </div>
    </div>
  )
}

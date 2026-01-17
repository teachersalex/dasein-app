import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { loginWithEmail, loginWithGoogle, getUserProfile } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    
    const result = await loginWithGoogle()
    
    if (result.success) {
      const profile = await getUserProfile(result.user.uid)
      
      if (profile) {
        navigate('/home')
      } else {
        setError('Conta não encontrada. Você precisa de um convite para entrar.')
      }
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const result = await loginWithEmail(email, password)
    
    if (result.success) {
      const profile = await getUserProfile(result.user.uid)
      
      if (profile) {
        navigate('/home')
      } else {
        navigate('/auth?step=onboarding')
      }
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" className="auth-back">← voltar</Link>
      </header>
      
      <h1 className="auth-title">Entrar</h1>
      <p className="auth-subtitle">Bem-vindo de volta</p>
      
      <div className="auth-spacer" />
      
      <button 
        className="btn btn-google btn-full" 
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <GoogleIcon />
        Continuar com Google
      </button>
      
      <div className="divider">
        <span>ou</span>
      </div>
      
      <form onSubmit={handleEmailLogin}>
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
            placeholder="sua senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        
        {error && <p className="auth-error">{error}</p>}
        
        {loading && (
          <div className="auth-loading">
            <div className="spinner spinner-sm" />
            <span>Entrando...</span>
          </div>
        )}
        
        <button 
          type="submit" 
          className="btn btn-full"
          disabled={loading}
        >
          Entrar
        </button>
      </form>
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

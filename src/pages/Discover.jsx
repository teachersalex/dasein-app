import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { searchUsers } from '../lib/follows'
import { getReceivedLikes } from '../lib/likes'
import FadeImage from '../components/FadeImage'
import './Discover.css'

export default function Discover() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const inputRef = useRef(null)
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [hasNewActivity, setHasNewActivity] = useState(false)

  // Foco automático no input
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Badge de atividade
  useEffect(() => {
    if (!user) return
    
    async function checkActivity() {
      const likes = await getReceivedLikes(user.uid, 1)
      if (likes.length === 0) {
        setHasNewActivity(false)
        return
      }
      
      const lastActivity = likes[0].createdAt?.toMillis() || 0
      const lastSeen = parseInt(localStorage.getItem('lastActivitySeen') || '0')
      setHasNewActivity(lastActivity > lastSeen)
    }
    
    checkActivity()
  }, [user])

  // Busca com debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      const users = await searchUsers(query.trim())
      // Não mostrar a si mesmo nos resultados
      setResults(users.filter(u => u.id !== user?.uid))
      setSearching(false)
      setHasSearched(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, user?.uid])

  function goToProfile(username) {
    navigate(`/profile/${username}`)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setHasSearched(false)
    inputRef.current?.focus()
  }

  return (
    <div className="discover-page fade-in">
      <header className="discover-header">
        <h1 className="discover-title">Descoberta</h1>
      </header>

      <div className="discover-search">
        <div className="search-input-wrapper">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Buscar por @username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
          {query && (
            <button className="search-clear" onClick={handleClear}>
              <ClearIcon />
            </button>
          )}
        </div>
      </div>

      <div className="discover-content">
        {!hasSearched && !query && (
          <div className="discover-empty">
            <div className="discover-empty-icon">
              <DiscoverLargeIcon />
            </div>
            <p className="discover-empty-text">Encontre pessoas pelo @</p>
          </div>
        )}

        {searching && (
          <div className="discover-loading">
            <div className="spinner" />
          </div>
        )}

        {hasSearched && !searching && results.length === 0 && (
          <div className="discover-empty">
            <p className="discover-empty-text">Nenhum resultado para "{query}"</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="discover-results">
            {results.map(profile => (
              <div 
                key={profile.id}
                className="discover-item"
                onClick={() => goToProfile(profile.username)}
              >
                <div className="avatar avatar-md">
                  {profile.photoURL ? (
                    <FadeImage src={profile.photoURL} alt={profile.displayName} />
                  ) : (
                    <span>{profile.displayName?.charAt(0).toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="discover-item-info">
                  <span className="discover-item-name">{profile.displayName}</span>
                  <span className="discover-item-username">@{profile.username}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="feed-nav">
        <button 
          className="feed-nav-btn"
          onClick={() => navigate('/feed')}
        >
          <FeedIcon />
        </button>
        <button 
          className="feed-nav-btn"
          onClick={() => navigate('/activity')}
        >
          <SparkIcon />
          {hasNewActivity && <span className="nav-badge" />}
        </button>
        <button 
          className="feed-nav-btn feed-nav-capture"
          onClick={() => navigate('/home')}
        >
          <CaptureIcon />
        </button>
        <button 
          className="feed-nav-btn active"
        >
          <DiscoverIcon />
        </button>
        <button 
          className="feed-nav-btn"
          onClick={() => navigate('/profile')}
        >
          <ProfileIcon />
        </button>
      </nav>
    </div>
  )
}

// Ícones

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}

function DiscoverLargeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  )
}

function FeedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
    </svg>
  )
}

function CaptureIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
    </svg>
  )
}

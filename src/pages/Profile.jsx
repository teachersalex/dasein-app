import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUserPosts } from '../lib/posts'
import { getUserInvites, createInvite } from '../lib/invites'
import { getFilterClass } from '../lib/filters'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { username } = useParams()
  const { user, profile, logout } = useAuth()
  
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [invitesPanelOpen, setInvitesPanelOpen] = useState(false)
  const [invites, setInvites] = useState([])
  const [generatingInvite, setGeneratingInvite] = useState(false)

  // TODO: Se username passado, carregar outro perfil
  const displayProfile = profile
  const isOwnProfile = true

  useEffect(() => {
    if (user) {
      loadPosts()
    }
  }, [user])

  async function loadPosts() {
    const userPosts = await getUserPosts(user.uid)
    setPosts(userPosts)
    setLoading(false)
  }

  async function loadInvites() {
    const userInvites = await getUserInvites(user.uid)
    setInvites(userInvites)
  }

  function toggleInvitesPanel() {
    setInvitesPanelOpen(!invitesPanelOpen)
    if (!invitesPanelOpen) {
      loadInvites()
    }
  }

  async function handleGenerateInvite() {
    const available = profile?.invitesAvailable
    
    if (available === 0) {
      alert('Você não tem convites disponíveis.')
      return
    }
    
    const msg = available === -1 
      ? 'Gerar um novo código de convite?' 
      : `Gerar convite? Você tem ${available} restante${available > 1 ? 's' : ''}.`
    
    if (!confirm(msg)) return
    
    setGeneratingInvite(true)
    
    const result = await createInvite(user.uid)
    
    if (result.success) {
      await navigator.clipboard.writeText(result.code)
      alert(`Convite copiado!\n\n${result.code}`)
      loadInvites()
    } else {
      alert(result.error || 'Erro ao criar convite.')
    }
    
    setGeneratingInvite(false)
  }

  async function copyInviteCode(code) {
    await navigator.clipboard.writeText(code)
    // Could use toast here
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  if (!displayProfile) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  const invitesAvailable = displayProfile.invitesAvailable

  return (
    <div className="profile-page fade-in">
      <header className="profile-header">
        <div 
          className="avatar avatar-lg"
          style={{ margin: '0 auto 24px' }}
        >
          {displayProfile.photoURL ? (
            <img src={displayProfile.photoURL} alt={displayProfile.displayName} />
          ) : (
            displayProfile.displayName?.charAt(0).toUpperCase()
          )}
        </div>
        
        <h1 className="profile-name">{displayProfile.displayName}</h1>
        <p className="profile-username">@{displayProfile.username}</p>
        
        {(displayProfile.status || displayProfile.profession || displayProfile.location) && (
          <p className="profile-bio">
            {[displayProfile.status, displayProfile.profession, displayProfile.location]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        
        {isOwnProfile && (
          <div className="profile-actions">
            <button className="btn" onClick={() => navigate('/home')}>
              + Nova foto
            </button>
            <button 
              className="btn-settings"
              onClick={() => navigate('/settings')}
            >
              ⚙
            </button>
          </div>
        )}
        
        {isOwnProfile && (invitesAvailable === -1 || invitesAvailable > 0) && (
          <button className="invites-badge" onClick={toggleInvitesPanel}>
            <span className="sparkle">✨</span>
            <span>
              <strong>{invitesAvailable === -1 ? '∞' : invitesAvailable}</strong> convites
            </span>
          </button>
        )}
        
        {invitesPanelOpen && (
          <div className="invites-panel">
            <h3>Seus convites</h3>
            
            <div className="invites-list">
              {invites.length === 0 ? (
                <p className="invites-empty">Nenhum convite gerado ainda</p>
              ) : (
                invites.map(inv => (
                  <div key={inv.id} className="invite-item">
                    <span className="invite-code">{inv.code}</span>
                    <span className={`invite-status ${inv.status}`}>
                      {inv.status === 'available' ? 'disponível' : 'usado'}
                    </span>
                    {inv.status === 'available' && (
                      <button 
                        className="invite-copy"
                        onClick={() => copyInviteCode(inv.code)}
                      >
                        copiar
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <button 
              className="btn btn-secondary btn-full"
              onClick={handleGenerateInvite}
              disabled={generatingInvite}
              style={{ marginTop: 16 }}
            >
              {generatingInvite ? 'Gerando...' : '+ Gerar novo convite'}
            </button>
          </div>
        )}
      </header>
      
      <div className="photo-grid">
        {loading ? (
          <div className="profile-loading">
            <div className="spinner" />
          </div>
        ) : posts.length === 0 ? (
          <div className="profile-empty">
            <p>Nenhuma foto ainda.</p>
            <button className="btn" onClick={() => navigate('/home')}>
              Tirar primeira foto
            </button>
          </div>
        ) : (
          posts.map((post, index) => (
            <div 
              key={post.id} 
              className={`photo-grid-item ${index === 0 ? 'featured' : ''}`}
              onClick={() => navigate(`/post/${post.id}`, { state: { post, profile: displayProfile } })}
            >
              <img 
                src={post.photoURL} 
                alt="" 
                className={getFilterClass(post.filter)}
              />
            </div>
          ))
        )}
      </div>
      
      {isOwnProfile && (
        <button className="logout-link" onClick={handleLogout}>
          sair
        </button>
      )}
    </div>
  )
}

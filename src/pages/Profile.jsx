import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUserPosts } from '../lib/posts'
import { getUserInvites, createInvite } from '../lib/invites'
import { getUserByUsername, isFollowing, followUser, unfollowUser } from '../lib/follows'
import { getFilterClass } from '../lib/filters'
import FollowModal from '../components/FollowModal'
import FadeImage from '../components/FadeImage'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { username } = useParams()
  const { user, profile, setProfile, logout, getUserProfile } = useAuth()
  
  const [viewProfile, setViewProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [invitesPanelOpen, setInvitesPanelOpen] = useState(false)
  const [invites, setInvites] = useState([])
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)
  
  // Follow state
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  
  // Modal state
  const [modalType, setModalType] = useState(null) // 'followers' | 'following' | null

  const isOwnProfile = !username || (profile && username === profile.username)

  // Load profile (own or other user's)
  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      
      if (isOwnProfile) {
        setViewProfile(profile)
        if (user) {
          const userPosts = await getUserPosts(user.uid)
          setPosts(userPosts)
        }
      } else {
        // Load other user's profile
        const otherProfile = await getUserByUsername(username)
        
        if (otherProfile) {
          setViewProfile(otherProfile)
          
          // Check if following
          if (user) {
            const isFollow = await isFollowing(user.uid, otherProfile.id)
            setFollowing(isFollow)
          }
          
          // Load their posts
          const userPosts = await getUserPosts(otherProfile.id)
          setPosts(userPosts)
        } else {
          setViewProfile(null)
        }
      }
      
      setLoading(false)
    }

    if (user) {
      loadProfile()
    }
  }, [user, username, profile, isOwnProfile])

  async function loadInvites() {
    try {
      const userInvites = await getUserInvites(user.uid)
      setInvites(userInvites)
    } catch (err) {
      console.error('Erro ao carregar convites:', err)
    }
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
    
    try {
      const result = await createInvite(user.uid)
      
      if (result.success) {
        const inviteLink = `getdasein.app/${result.code}`
        await navigator.clipboard.writeText(inviteLink)
        alert(`Convite copiado!\n\n${inviteLink}`)
        await loadInvites()
        
        // Atualiza contadores locais (se não for infinito)
        if (available !== -1) {
          const newAvailable = available - 1
          setProfile({ ...profile, invitesAvailable: newAvailable })
          setViewProfile(prev => ({ ...prev, invitesAvailable: newAvailable }))
        }
      } else {
        alert(result.error || 'Erro ao criar convite.')
      }
    } catch (err) {
      console.error('Erro ao gerar convite:', err)
      alert('Erro ao gerar convite. Tente novamente.')
    } finally {
      setGeneratingInvite(false)
    }
  }

  async function copyInviteCode(code) {
    await navigator.clipboard.writeText(`getdasein.app/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  // Follow/Unfollow handlers
  async function handleFollow() {
    if (!viewProfile || followLoading) return
    
    setFollowLoading(true)
    
    const result = await followUser(user.uid, viewProfile.id)
    
    if (result.success) {
      setFollowing(true)
      // Update local counter
      setViewProfile(prev => ({
        ...prev,
        followersCount: (prev.followersCount || 0) + 1
      }))
    }
    
    setFollowLoading(false)
  }

  async function handleUnfollow() {
    if (!viewProfile || followLoading) return
    
    setFollowLoading(true)
    
    const result = await unfollowUser(user.uid, viewProfile.id)
    
    if (result.success) {
      setFollowing(false)
      // Update local counter
      setViewProfile(prev => ({
        ...prev,
        followersCount: Math.max(0, (prev.followersCount || 0) - 1)
      }))
    }
    
    setFollowLoading(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  // Profile not found
  if (!viewProfile) {
    return (
      <div className="screen-center">
        <p className="text-caption">Usuário não encontrado</p>
        <button 
          className="btn btn-ghost" 
          onClick={() => navigate('/home')}
          style={{ marginTop: 16 }}
        >
          Voltar
        </button>
      </div>
    )
  }

  const invitesAvailable = viewProfile.invitesAvailable
  const followersCount = viewProfile.followersCount || 0
  const followingCount = viewProfile.followingCount || 0

  return (
    <div className="profile-page fade-in">
      {/* Back button for other profiles */}
      {!isOwnProfile && (
        <button 
          className="profile-back"
          onClick={() => navigate(-1)}
        >
          ← voltar
        </button>
      )}

      <header className="profile-header">
        <div 
          className="avatar avatar-lg"
          style={{ margin: '0 auto 24px' }}
        >
          {viewProfile.photoURL ? (
            <FadeImage src={viewProfile.photoURL} alt={viewProfile.displayName} />
          ) : (
            viewProfile.displayName?.charAt(0).toUpperCase()
          )}
        </div>
        
        <h1 className="profile-name">{viewProfile.displayName}</h1>
        <p className="profile-username">@{viewProfile.username}</p>
        
        {/* Stats - clickable */}
        <div className="profile-stats">
          <div className="stat">
            <span className="stat-number">{posts.length}</span>
            <span className="stat-label">posts</span>
          </div>
          <div 
            className="stat stat-clickable"
            onClick={() => followersCount > 0 && setModalType('followers')}
          >
            <span className="stat-number">{followersCount}</span>
            <span className="stat-label">seguidores</span>
          </div>
          <div 
            className="stat stat-clickable"
            onClick={() => followingCount > 0 && setModalType('following')}
          >
            <span className="stat-number">{followingCount}</span>
            <span className="stat-label">seguindo</span>
          </div>
        </div>
        
        {(viewProfile.status || viewProfile.profession || viewProfile.location) && (
          <p className="profile-bio">
            {[viewProfile.status, viewProfile.profession, viewProfile.location]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        
        {/* Actions - different for own profile vs others */}
        {isOwnProfile ? (
          <>
            <div className="profile-actions">
              <button className="profile-action-btn" onClick={() => navigate('/feed')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </button>
              <button className="profile-action-btn" onClick={() => navigate('/home')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <button 
                className="profile-action-btn"
                onClick={() => navigate('/settings')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
            
            {(invitesAvailable === -1 || invitesAvailable > 0) && (
              <button className="invites-badge" onClick={toggleInvitesPanel}>
                <span className="invites-count">{invitesAvailable === -1 ? '∞' : invitesAvailable}</span>
                <span className="invites-label">convites</span>
              </button>
            )}
          </>
        ) : (
          <div className="profile-actions">
            <button 
              className={`btn ${following ? 'btn-secondary' : ''}`}
              onClick={following ? handleUnfollow : handleFollow}
              disabled={followLoading}
            >
              {followLoading ? '...' : following ? 'Seguindo' : 'Seguir'}
            </button>
          </div>
        )}
        
        {invitesPanelOpen && isOwnProfile && (
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
                        style={copiedCode === inv.code ? { color: 'var(--color-success)' } : {}}
                      >
                        {copiedCode === inv.code ? 'copiado!' : 'copiar'}
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
        {posts.length === 0 ? (
          <div className="profile-empty">
            <p>{isOwnProfile ? 'Nenhuma foto ainda.' : 'Nenhuma foto ainda.'}</p>
            {isOwnProfile && (
              <button className="btn" onClick={() => navigate('/home')}>
                Tirar primeira foto
              </button>
            )}
          </div>
        ) : (
          posts.map((post, index) => (
            <div 
              key={post.id} 
              className={`photo-grid-item ${index === 0 ? 'featured' : ''}`}
              onClick={() => navigate(`/post/${post.id}`, { state: { post, profile: viewProfile } })}
            >
              <FadeImage 
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

      {/* Follow Modal */}
      {modalType && (
        <FollowModal 
          userId={viewProfile.id}
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  )
}
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getReceivedLikes } from '../lib/likes'
import { getInviteActivities } from '../lib/invites'
import { formatTime } from '../lib/utils'
import FadeImage from '../components/FadeImage'
import './Activity.css'

export default function Activity() {
  const navigate = useNavigate()
  const { user, profile, getUserProfile } = useAuth()
  
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState({})

  useEffect(() => {
    if (user) {
      loadActivities()
    }
  }, [user])

  async function loadActivities() {
    setLoading(true)
    
    // 🔧 FIX: Promise.all para buscar likes e convites em paralelo
    const [likes, inviteActivities] = await Promise.all([
      getReceivedLikes(user.uid, 30),
      getInviteActivities(user.uid, 20)
    ])
    
    // Transformar likes em atividades
    const likeItems = likes.map(like => ({
      id: like.id,
      type: 'like',
      userId: like.userId,
      postId: like.postId,
      createdAt: like.createdAt?.toMillis() || Date.now()
    }))
    
    // Transformar convites em atividades
    const inviteItems = inviteActivities.map(activity => ({
      id: activity.id,
      type: 'invite_used',
      userId: activity.userId,
      createdAt: activity.createdAt?.toMillis() || Date.now()
    }))
    
    // Combinar e ordenar por data
    const items = [...likeItems, ...inviteItems]
    items.sort((a, b) => b.createdAt - a.createdAt)
    
    setActivities(items)
    
    // Marcar como visto — remove o badge no Feed
    if (items.length > 0) {
      localStorage.setItem('lastActivitySeen', items[0].createdAt.toString())
    }
    
    // 🔧 FIX: Promise.all para carregar perfis em paralelo
    const uniqueUserIds = [...new Set(items.map(a => a.userId))]
    
    const profilesArray = await Promise.all(
      uniqueUserIds.map(uid => getUserProfile(uid))
    )
    
    const profilesMap = {}
    uniqueUserIds.forEach((uid, index) => {
      if (profilesArray[index]) {
        profilesMap[uid] = profilesArray[index]
      }
    })
    
    setProfiles(profilesMap)
    setLoading(false)
  }

  function goToProfile(username) {
    if (username) {
      navigate(`/profile/${username}`)
    }
  }

  if (loading) {
    return (
      <div className="activity-page">
        <header className="activity-header">
          <h1 className="activity-title">Atividade</h1>
        </header>
        <div className="screen-center">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="activity-page fade-in">
      <header className="activity-header">
        <h1 className="activity-title">Atividade</h1>
      </header>

      {activities.length === 0 ? (
        <div className="activity-empty">
          <SparkIconLarge />
          <p>Nenhuma atividade ainda</p>
          <p className="activity-empty-hint">
            Quando alguém curtir suas fotos, você verá aqui
          </p>
        </div>
      ) : (
        <div className="activity-list">
          {activities.map(activity => {
            const actorProfile = profiles[activity.userId]
            
            return (
              <div 
                key={activity.id} 
                className="activity-item"
                onClick={() => goToProfile(actorProfile?.username)}
              >
                <div className="activity-avatar">
                  <div className="avatar avatar-sm">
                    {actorProfile?.photoURL ? (
                      <FadeImage src={actorProfile.photoURL} alt={actorProfile.displayName} />
                    ) : (
                      actorProfile?.displayName?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                </div>
                
                <div className="activity-content">
                  <p className="activity-text">
                    <span className="activity-name">
                      {actorProfile?.displayName || 'Alguém'}
                    </span>
                    {activity.type === 'like' && ' curtiu sua foto'}
                    {activity.type === 'invite_used' && ' entrou pelo seu convite 🌱'}
                    {activity.type === 'visit' && ' visitou seu perfil'}
                  </p>
                  {/* 🔧 FIX: Usa formatTime do utils */}
                  <span className="activity-time">{formatTime(activity.createdAt)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SparkIconLarge() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
    </svg>
  )
}
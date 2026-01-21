import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { purgeExpiredInvites } from '../lib/invites'
import { useToast } from '../components/Toast'
import './Admin.css'

const ADMIN_USERNAMES = ['alex']

export default function Admin() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(null)
  const [users, setUsers] = useState([])
  const [purging, setPurging] = useState(false)

  const isAdmin = profile && ADMIN_USERNAMES.includes(profile.username)

  useEffect(() => {
    if (!authLoading && isAdmin) loadData()
  }, [authLoading, isAdmin])

  async function loadData() {
    setLoading(true)
    try {
      const [usersSnap, postsSnap, likesSnap, invitesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'likes')),
        getDocs(collection(db, 'invites'))
      ])

      const invitesDocs = invitesSnap.docs.map(d => d.data())
      
      setMetrics({
        users: usersSnap.size,
        posts: postsSnap.size,
        likes: likesSnap.size,
        invitesUsed: invitesDocs.filter(i => i.status === 'used').length,
        invitesAvailable: invitesDocs.filter(i => i.status === 'available').length
      })

      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
      showToast('Erro ao carregar dados', 'error')
    }
    setLoading(false)
  }

  async function handlePurge() {
    if (!confirm('Limpar convites expirados (+12h)?')) return
    
    setPurging(true)
    const result = await purgeExpiredInvites(user.uid)
    setPurging(false)
    
    if (result.success) {
      showToast(`${result.deleted} convite(s) removido(s)`, 'success')
      loadData()
    } else {
      showToast(result.error || 'Erro', 'error')
    }
  }

  // Loading / Access
  if (authLoading || loading) {
    return <div className="admin"><div className="spinner" /></div>
  }

  if (!user || !isAdmin) {
    return (
      <div className="admin">
        <p>Acesso negado</p>
        <button onClick={() => navigate('/feed')}>Voltar</button>
      </div>
    )
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <button onClick={() => navigate('/profile')}>← Voltar</button>
        <h1>Admin</h1>
        <button onClick={loadData}>↻</button>
      </header>

      {metrics && (
        <div className="admin-metrics">
          <div className="metric">
            <span className="metric-value">{metrics.users}</span>
            <span className="metric-label">usuários</span>
          </div>
          <div className="metric">
            <span className="metric-value">{metrics.posts}</span>
            <span className="metric-label">posts</span>
          </div>
          <div className="metric">
            <span className="metric-value">{metrics.likes}</span>
            <span className="metric-label">likes</span>
          </div>
          <div className="metric">
            <span className="metric-value">{metrics.invitesUsed}/{metrics.invitesUsed + metrics.invitesAvailable}</span>
            <span className="metric-label">convites</span>
          </div>
        </div>
      )}

      <div className="admin-section">
        <h2>Ações</h2>
        <button 
          className="btn-danger" 
          onClick={handlePurge} 
          disabled={purging}
        >
          {purging ? 'Limpando...' : '🗑️ Limpar convites expirados'}
        </button>
      </div>

      <div className="admin-section">
        <h2>Usuários ({users.length})</h2>
        <ul className="admin-users">
          {users.map(u => (
            <li key={u.id} onClick={() => navigate(`/profile/${u.username}`)}>
              <span>@{u.username}</span>
              <span className="user-name">{u.displayName}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

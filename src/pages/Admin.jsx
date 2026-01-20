import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  where,
  Timestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { deletePost } from '../lib/posts'
import { purgeExpiredInvites } from '../lib/invites'
import FadeImage from '../components/FadeImage'
import './Admin.css'

// 🔒 ADMIN UIDs - só esses usuários acessam
const ADMIN_USERNAMES = ['alex']

export default function Admin() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Data
  const [metrics, setMetrics] = useState(null)
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [inviteTree, setInviteTree] = useState([])
  const [growthMetrics, setGrowthMetrics] = useState(null)
  const [purging, setPurging] = useState(false)

  // Check admin access
  const isAdmin = profile && ADMIN_USERNAMES.includes(profile.username)

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadAllData()
    }
  }, [authLoading, isAdmin])

  async function loadAllData() {
    setLoading(true)
    await Promise.all([
      loadMetrics(),
      loadUsers(),
      loadPosts(),
      loadGrowthMetrics()
    ])
    setLoading(false)
  }

  // === METRICS ===
  async function loadMetrics() {
    try {
      const [usersSnap, postsSnap, likesSnap, invitesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'likes')),
        getDocs(collection(db, 'invites'))
      ])

      const usedInvites = invitesSnap.docs.filter(d => d.data().status === 'used').length
      const availableInvites = invitesSnap.docs.filter(d => d.data().status === 'available').length

      setMetrics({
        totalUsers: usersSnap.size,
        totalPosts: postsSnap.size,
        totalLikes: likesSnap.size,
        invitesUsed: usedInvites,
        invitesAvailable: availableInvites
      })
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  // === USERS ===
  async function loadUsers() {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      
      const usersData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Load post counts for each user
      const postsSnap = await getDocs(collection(db, 'posts'))
      const postCounts = {}
      postsSnap.docs.forEach(doc => {
        const userId = doc.data().userId
        postCounts[userId] = (postCounts[userId] || 0) + 1
      })

      const usersWithCounts = usersData.map(u => ({
        ...u,
        postCount: postCounts[u.id] || 0
      }))

      setUsers(usersWithCounts)
      buildInviteTree(usersWithCounts)
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  // === INVITE TREE ===
  function buildInviteTree(usersData) {
    // Find root users (no invitedBy or invitedBy is null)
    const roots = usersData.filter(u => !u.invitedBy)
    
    function getChildren(userId) {
      return usersData
        .filter(u => u.invitedBy === userId)
        .map(u => ({
          ...u,
          children: getChildren(u.id)
        }))
    }

    const tree = roots.map(root => ({
      ...root,
      children: getChildren(root.id)
    }))

    setInviteTree(tree)
  }

  // === POSTS ===
  async function loadPosts() {
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50))
      const snap = await getDocs(q)
      
      const postsData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setPosts(postsData)
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  // === GROWTH METRICS ===
  async function loadGrowthMetrics() {
    try {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const [usersSnap, postsSnap, likesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'likes'))
      ])

      // Users this week/month
      const usersThisWeek = usersSnap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate()
        return createdAt && createdAt > weekAgo
      }).length

      const usersThisMonth = usersSnap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate()
        return createdAt && createdAt > monthAgo
      }).length

      // Posts this week/month
      const postsThisWeek = postsSnap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate()
        return createdAt && createdAt > weekAgo
      }).length

      const postsThisMonth = postsSnap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate()
        return createdAt && createdAt > monthAgo
      }).length

      // Likes this week
      const likesThisWeek = likesSnap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate()
        return createdAt && createdAt > weekAgo
      }).length

      // Active users (posted in last 7 days)
      const activeUserIds = new Set()
      postsSnap.docs.forEach(doc => {
        const createdAt = doc.data().createdAt?.toDate()
        if (createdAt && createdAt > weekAgo) {
          activeUserIds.add(doc.data().userId)
        }
      })

      // Users who never posted
      const userIds = new Set(usersSnap.docs.map(d => d.id))
      const usersWhoPosted = new Set(postsSnap.docs.map(d => d.data().userId))
      const neverPosted = [...userIds].filter(id => !usersWhoPosted.has(id)).length

      // Average likes per post
      const avgLikesPerPost = postsSnap.size > 0 
        ? (likesSnap.size / postsSnap.size).toFixed(1) 
        : 0

      setGrowthMetrics({
        usersThisWeek,
        usersThisMonth,
        postsThisWeek,
        postsThisMonth,
        likesThisWeek,
        activeUsers: activeUserIds.size,
        neverPosted,
        avgLikesPerPost
      })
    } catch (error) {
      console.error('Error loading growth metrics:', error)
    }
  }

  // === ACTIONS ===
  async function handleDeletePost(postId, storagePath) {
    if (!confirm('Deletar este post?')) return
    
    const result = await deletePost(postId, storagePath)
    if (result.success) {
      setPosts(posts.filter(p => p.id !== postId))
      loadMetrics()
    } else {
      alert('Erro ao deletar post')
    }
  }

  async function handleBanUser(userId, currentBanned) {
    const action = currentBanned ? 'desbanir' : 'banir'
    if (!confirm(`Deseja ${action} este usuário?`)) return

    try {
      await updateDoc(doc(db, 'users', userId), {
        banned: !currentBanned
      })
      setUsers(users.map(u => 
        u.id === userId ? { ...u, banned: !currentBanned } : u
      ))
    } catch (error) {
      alert('Erro ao atualizar usuário')
    }
  }

  async function handlePurgeInvites() {
    if (!confirm('Deletar convites expirados (+12h)?')) return
    
    setPurging(true)
    const result = await purgeExpiredInvites(user.uid)
    setPurging(false)
    
    if (result.success) {
      alert(`${result.deleted} convite(s) expirado(s) deletado(s)`)
      loadMetrics()
    } else {
      alert(result.error || 'Erro ao limpar convites')
    }
  }

  // === RENDER HELPERS ===
  function formatDate(timestamp) {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    })
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function renderInviteNode(node, level = 0) {
    return (
      <div key={node.id} className="invite-node" style={{ marginLeft: level * 24 }}>
        <div className="invite-node-content">
          <span className="invite-node-line">{level > 0 ? '└─ ' : ''}</span>
          <span className="invite-node-name">@{node.username}</span>
          <span className="invite-node-date">{formatDate(node.createdAt)}</span>
          <span className="invite-node-posts">{node.postCount} posts</span>
        </div>
        {node.children?.map(child => renderInviteNode(child, level + 1))}
      </div>
    )
  }

  // === ACCESS CHECK ===
  if (authLoading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="screen-center">
        <p className="text-caption">Acesso negado</p>
        <button className="btn btn-ghost" onClick={() => navigate('/feed')} style={{ marginTop: 16 }}>
          Voltar
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
        <p className="text-caption" style={{ marginTop: 16 }}>Carregando dados...</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="btn btn-ghost" onClick={() => navigate('/profile')}>
          ← Voltar
        </button>
        <h1 className="admin-title">Admin</h1>
        <button className="btn btn-ghost" onClick={loadAllData}>
          ↻
        </button>
      </header>

      {/* Tabs */}
      <nav className="admin-tabs">
        {['overview', 'users', 'posts', 'tree'].map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && 'Visão Geral'}
            {tab === 'users' && 'Usuários'}
            {tab === 'posts' && 'Posts'}
            {tab === 'tree' && 'Convites'}
          </button>
        ))}
      </nav>

      <div className="admin-content">
        {/* === OVERVIEW === */}
        {activeTab === 'overview' && metrics && (
          <div className="admin-section">
            {/* Main Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-value">{metrics.totalUsers}</span>
                <span className="metric-label">Usuários</span>
              </div>
              <div className="metric-card">
                <span className="metric-value">{metrics.totalPosts}</span>
                <span className="metric-label">Posts</span>
              </div>
              <div className="metric-card">
                <span className="metric-value">{metrics.totalLikes}</span>
                <span className="metric-label">Likes</span>
              </div>
              <div className="metric-card">
                <span className="metric-value">{metrics.invitesUsed}/{metrics.invitesUsed + metrics.invitesAvailable}</span>
                <span className="metric-label">Convites usados</span>
              </div>
            </div>

            {/* Growth Metrics */}
            {growthMetrics && (
              <>
                <h2 className="admin-subtitle">Crescimento</h2>
                <div className="metrics-grid">
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.usersThisWeek}</span>
                    <span className="metric-label">Novos (7 dias)</span>
                  </div>
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.usersThisMonth}</span>
                    <span className="metric-label">Novos (30 dias)</span>
                  </div>
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.postsThisWeek}</span>
                    <span className="metric-label">Posts (7 dias)</span>
                  </div>
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.likesThisWeek}</span>
                    <span className="metric-label">Likes (7 dias)</span>
                  </div>
                </div>

                <h2 className="admin-subtitle">Engajamento</h2>
                <div className="metrics-grid">
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.activeUsers}</span>
                    <span className="metric-label">Ativos (7 dias)</span>
                  </div>
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.neverPosted}</span>
                    <span className="metric-label">Nunca postaram</span>
                  </div>
                  <div className="metric-card small">
                    <span className="metric-value">{growthMetrics.avgLikesPerPost}</span>
                    <span className="metric-label">Likes/post</span>
                  </div>
                  <div className="metric-card small">
                    <span className="metric-value">
                      {metrics.totalUsers > 0 
                        ? ((growthMetrics.activeUsers / metrics.totalUsers) * 100).toFixed(0) 
                        : 0}%
                    </span>
                    <span className="metric-label">Taxa atividade</span>
                  </div>
                </div>
              </>
            )}

            {/* Ações admin */}
            <h2 className="admin-subtitle">Ações</h2>
            <button 
              className="btn-small danger"
              onClick={handlePurgeInvites}
              disabled={purging}
              style={{ marginTop: 8 }}
            >
              {purging ? 'Limpando...' : '🗑️ Limpar convites expirados (+12h)'}
            </button>
          </div>
        )}

        {/* === USERS === */}
        {activeTab === 'users' && (
          <div className="admin-section">
            <p className="admin-count">{users.length} usuários</p>
            
            <div className="users-list">
              {users.map(u => (
                <div key={u.id} className={`user-row ${u.banned ? 'banned' : ''}`}>
                  <div className="user-avatar">
                    {u.photoURL ? (
                      <FadeImage src={u.photoURL} alt={u.displayName} />
                    ) : (
                      <span>{u.displayName?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  
                  <div className="user-info">
                    <span className="user-name">{u.displayName}</span>
                    <span className="user-username">@{u.username}</span>
                  </div>
                  
                  <div className="user-stats">
                    <span>{u.postCount} posts</span>
                    <span>{formatDate(u.createdAt)}</span>
                  </div>
                  
                  <div className="user-actions">
                    <button 
                      className="btn-small"
                      onClick={() => navigate(`/profile/${u.username}`)}
                    >
                      Ver
                    </button>
                    <button 
                      className={`btn-small ${u.banned ? 'success' : 'danger'}`}
                      onClick={() => handleBanUser(u.id, u.banned)}
                    >
                      {u.banned ? 'Desbanir' : 'Banir'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === POSTS === */}
        {activeTab === 'posts' && (
          <div className="admin-section">
            <p className="admin-count">{posts.length} posts (últimos 50)</p>
            
            <div className="posts-grid">
              {posts.map(post => {
                const author = users.find(u => u.id === post.userId)
                return (
                  <div key={post.id} className="post-card">
                    <div className="post-card-image">
                      <FadeImage src={post.photoURL} alt="" />
                    </div>
                    <div className="post-card-info">
                      <span className="post-card-author">@{author?.username || '?'}</span>
                      <span className="post-card-date">{formatDateTime(post.createdAt)}</span>
                    </div>
                    <button 
                      className="btn-small danger"
                      onClick={() => handleDeletePost(post.id, post.storagePath)}
                    >
                      Deletar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* === INVITE TREE === */}
        {activeTab === 'tree' && (
          <div className="admin-section">
            <p className="admin-count">Árvore de convites</p>
            
            <div className="invite-tree">
              {inviteTree.map(node => renderInviteNode(node))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import FadeImage from '../components/FadeImage'
import './Admin.css'

/*
 * Admin — Painel administrativo
 * 
 * Features:
 * - Métricas gerais
 * - Lista de usuários
 * - Posts recentes
 * - Árvore de convites
 * 
 * Acesso: apenas usuários com role 'admin'
 * Correção audit: confirm → modal customizado
 */

const ADMIN_TABS = [
  { id: 'overview', label: 'visão geral' },
  { id: 'users', label: 'usuários' },
  { id: 'posts', label: 'posts' },
  { id: 'invites', label: 'convites' }
]

export default function Admin() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { showToast } = useToast()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({})
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [inviteTree, setInviteTree] = useState([])

  // Modal de confirmação
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/feed')
      return
    }
    loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    
    try {
      // Paralelo
      const [usersSnap, postsSnap, invitesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(collection(db, 'invites'))
      ])
      
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const postsData = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const invitesData = invitesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      setUsers(usersData)
      setPosts(postsData)
      
      // Métricas
      const activeUsers = usersData.filter(u => !u.banned).length
      const totalPosts = postsData.length
      const usedInvites = invitesData.filter(i => i.status === 'used').length
      const availableInvites = invitesData.filter(i => i.status === 'available').length
      
      setMetrics({
        totalUsers: usersData.length,
        activeUsers,
        totalPosts,
        usedInvites,
        availableInvites
      })
      
      // Árvore de convites
      buildInviteTree(usersData)
      
    } catch (error) {
      console.error('Admin load error:', error)
      showToast('erro ao carregar dados', 'error')
    }
    
    setLoading(false)
  }

  function buildInviteTree(usersData) {
    const userMap = {}
    usersData.forEach(u => { userMap[u.id] = u })
    
    const roots = usersData.filter(u => !u.invitedBy || !userMap[u.invitedBy])
    
    function buildNode(user, depth = 0) {
      const children = usersData.filter(u => u.invitedBy === user.id)
      return {
        user,
        depth,
        children: children.map(c => buildNode(c, depth + 1))
      }
    }
    
    setInviteTree(roots.map(r => buildNode(r)))
  }

  async function handleBanUser(userId, currentBanned) {
    setConfirmAction({
      type: currentBanned ? 'unban' : 'ban',
      userId,
      message: currentBanned ? 'desbanir este usuário?' : 'banir este usuário?',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', userId), { banned: !currentBanned })
          setUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, banned: !currentBanned } : u
          ))
          showToast(currentBanned ? 'usuário desbanido' : 'usuário banido', 'success')
        } catch (error) {
          showToast('erro ao atualizar', 'error')
        }
        setConfirmAction(null)
      }
    })
  }

  async function handleDeletePost(postId) {
    setConfirmAction({
      type: 'delete',
      postId,
      message: 'apagar este post?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'posts', postId))
          setPosts(prev => prev.filter(p => p.id !== postId))
          showToast('post apagado', 'success')
        } catch (error) {
          showToast('erro ao apagar', 'error')
        }
        setConfirmAction(null)
      }
    })
  }

  function formatDate(timestamp) {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="screen-center">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="admin-back" onClick={() => navigate('/profile')}>
          ← voltar
        </button>
        <h1 className="admin-title">admin</h1>
        <div style={{ width: 60 }} />
      </header>

      <nav className="admin-tabs">
        {ADMIN_TABS.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-content">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="admin-section">
            <div className="metrics-grid">
              <MetricCard value={metrics.totalUsers} label="usuários" />
              <MetricCard value={metrics.activeUsers} label="ativos" />
              <MetricCard value={metrics.totalPosts} label="posts" />
              <MetricCard value={metrics.usedInvites} label="convites usados" />
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className="admin-section">
            <p className="admin-count">{users.length} usuários</p>
            <div className="users-list">
              {users.map(user => (
                <div key={user.id} className={`user-row ${user.banned ? 'banned' : ''}`}>
                  <div className="user-avatar">
                    {user.photoURL ? (
                      <FadeImage src={user.photoURL} alt="" />
                    ) : (
                      user.displayName?.charAt(0) || '?'
                    )}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{user.displayName}</span>
                    <span className="user-username">@{user.username}</span>
                  </div>
                  <div className="user-stats">
                    <span>{user.postsCount || 0} posts</span>
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="user-actions">
                    <button 
                      className={`admin-btn-small ${user.banned ? 'success' : 'danger'}`}
                      onClick={() => handleBanUser(user.id, user.banned)}
                    >
                      {user.banned ? 'desbanir' : 'banir'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        {activeTab === 'posts' && (
          <div className="admin-section">
            <p className="admin-count">{posts.length} posts recentes</p>
            <div className="posts-grid">
              {posts.map(post => {
                const author = users.find(u => u.id === post.userId)
                return (
                  <div key={post.id} className="post-card">
                    <div className="post-card-image">
                      <FadeImage src={post.photoURL} alt="" />
                    </div>
                    <div className="post-card-info">
                      <span className="post-card-author">
                        @{author?.username || 'unknown'}
                      </span>
                      <span className="post-card-date">
                        {formatDate(post.createdAt)}
                      </span>
                    </div>
                    <button 
                      className="admin-btn-small danger full"
                      onClick={() => handleDeletePost(post.id)}
                    >
                      apagar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Invites Tree */}
        {activeTab === 'invites' && (
          <div className="admin-section">
            <p className="admin-count">
              {metrics.usedInvites} usados · {metrics.availableInvites} disponíveis
            </p>
            <div className="invite-tree">
              {inviteTree.map(node => (
                <InviteNode key={node.user.id} node={node} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="confirm-modal" onClick={() => setConfirmAction(null)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <p className="confirm-message">{confirmAction.message}</p>
            <div className="confirm-actions">
              <button 
                className="confirm-cancel"
                onClick={() => setConfirmAction(null)}
              >
                cancelar
              </button>
              <button 
                className="confirm-btn danger"
                onClick={confirmAction.onConfirm}
              >
                confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// === Components ===

function MetricCard({ value, label }) {
  return (
    <div className="metric-card">
      <span className="metric-value">{value || 0}</span>
      <span className="metric-label">{label}</span>
    </div>
  )
}

function InviteNode({ node }) {
  const { user, depth, children } = node
  
  return (
    <div className="invite-node">
      <div className="invite-node-content" style={{ paddingLeft: depth * 20 }}>
        {depth > 0 && <span className="invite-node-line">└─</span>}
        <span className="invite-node-name">@{user.username}</span>
        <span className="invite-node-posts">{user.postsCount || 0}p</span>
      </div>
      {children.map(child => (
        <InviteNode key={child.user.id} node={child} />
      ))}
    </div>
  )
}
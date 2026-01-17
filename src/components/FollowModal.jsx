import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFollowers, getFollowing } from '../lib/follows'
import './FollowModal.css'

export default function FollowModal({ userId, type, onClose }) {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const title = type === 'followers' ? 'Seguidores' : 'Seguindo'

  useEffect(() => {
    async function loadUsers() {
      setLoading(true)
      
      const list = type === 'followers' 
        ? await getFollowers(userId)
        : await getFollowing(userId)
      
      setUsers(list)
      setLoading(false)
    }

    loadUsers()
  }, [userId, type])

  function handleUserClick(username) {
    onClose()
    navigate(`/profile/${username}`)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="spinner" />
            </div>
          ) : users.length === 0 ? (
            <p className="modal-empty">
              {type === 'followers' 
                ? 'Nenhum seguidor ainda' 
                : 'Não está seguindo ninguém'}
            </p>
          ) : (
            <ul className="user-list">
              {users.map(user => (
                <li 
                  key={user.id} 
                  className="user-item"
                  onClick={() => handleUserClick(user.username)}
                >
                  <div className="avatar avatar-sm">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} />
                    ) : (
                      user.displayName?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{user.displayName}</span>
                    <span className="user-username">@{user.username}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

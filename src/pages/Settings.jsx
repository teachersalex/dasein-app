import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { storage } from '../lib/firebase'
import { resizeImage } from '../lib/utils'
import './Settings.css'

/*
 * Settings — Edição de perfil
 * 
 * Features:
 * - Upload e resize de avatar
 * - Edição de nome, username, bio
 * - Validação de username único
 * 
 * Correções audit:
 * - Modais customizados (sem confirm/alert nativos)
 * - resizeImage do utils
 */

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, setProfile, updateUserProfile, isUsernameTaken, logout } = useAuth()
  const { showToast } = useToast()
  
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')
  const [profession, setProfession] = useState('')
  const [location, setLocation] = useState('')
  
  const [originalData, setOriginalData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  // Modals
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '')
      setUsername(profile.username || '')
      setStatus(profile.status || '')
      setProfession(profile.profession || '')
      setLocation(profile.location || '')
      
      setOriginalData({
        displayName: profile.displayName || '',
        username: profile.username || '',
        status: profile.status || '',
        profession: profile.profession || '',
        location: profile.location || ''
      })
    }
  }, [profile])

  useEffect(() => {
    const current = { displayName, username: username.toLowerCase(), status, profession, location }
    setHasChanges(JSON.stringify(current) !== JSON.stringify(originalData))
  }, [displayName, username, status, profession, location, originalData])

  function handleUsernameChange(e) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    setUsernameError('')
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      showToast('selecione uma imagem válida', 'error')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showToast('imagem muito grande (máx. 5MB)', 'error')
      return
    }
    
    setUploadingAvatar(true)
    
    try {
      // Resize usando utils
      resizeImage(file, 400, async (resized) => {
        try {
          const fileName = `avatars/${user.uid}_${Date.now()}.jpg`
          const storageRef = ref(storage, fileName)
          await uploadBytes(storageRef, resized)
          
          const photoURL = await getDownloadURL(storageRef)
          
          await updateUserProfile(user.uid, { photoURL })
          setProfile({ ...profile, photoURL })
          
          showToast('foto atualizada!', 'success')
        } catch (error) {
          console.error('Upload error:', error)
          showToast('erro ao enviar foto', 'error')
        } finally {
          setUploadingAvatar(false)
        }
      })
    } catch (error) {
      console.error('Resize error:', error)
      showToast('erro ao processar imagem', 'error')
      setUploadingAvatar(false)
    }
    
    e.target.value = ''
  }

  async function handleSave() {
    if (!displayName.trim()) {
      showToast('nome é obrigatório', 'error')
      return
    }
    
    if (username.length < 3) {
      showToast('username deve ter pelo menos 3 caracteres', 'error')
      return
    }
    
    if (username !== originalData.username) {
      const taken = await isUsernameTaken(username)
      if (taken) {
        setUsernameError('username já está em uso')
        showToast('username já está em uso', 'error')
        return
      }
    }
    
    setSaving(true)
    
    const data = {
      displayName: displayName.trim(),
      username: username.toLowerCase(),
      status,
      profession: profession.trim(),
      location: location.trim()
    }
    
    const result = await updateUserProfile(user.uid, data)
    
    if (result.success) {
      setProfile({ ...profile, ...data })
      setOriginalData(data)
      showToast('perfil atualizado!', 'success')
    } else {
      showToast('erro ao salvar', 'error')
    }
    
    setSaving(false)
  }

  async function handleLogout() {
    setShowLogoutConfirm(false)
    await logout()
    navigate('/')
  }

  function handleBack() {
    if (hasChanges) {
      setShowUnsavedConfirm(true)
    } else {
      navigate('/profile')
    }
  }

  function confirmLeave() {
    setShowUnsavedConfirm(false)
    navigate('/profile')
  }

  if (!profile) {
    return (
      <div className="settings-page">
        <div className="screen-center">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="settings-back" onClick={handleBack}>
          <BackIcon />
          <span>voltar</span>
        </button>
        <h1 className="settings-title">editar perfil</h1>
        <button 
          className="settings-save"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? '...' : 'salvar'}
        </button>
      </header>
      
      <div className="settings-content">
        {/* Avatar */}
        <section className="settings-avatar-section">
          <label className="settings-avatar-wrapper">
            <div className="avatar avatar-xl">
              {uploadingAvatar ? (
                <div className="spinner" />
              ) : profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} />
              ) : (
                profile.displayName?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="settings-avatar-overlay">
              <CameraIcon />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
              disabled={uploadingAvatar}
            />
          </label>
          <span className="settings-avatar-hint">toque para alterar</span>
        </section>
        
        {/* Info */}
        <section className="settings-section">
          <h2 className="settings-section-title">informações</h2>
          
          <div className="settings-field">
            <label className="settings-label">nome</label>
            <input
              type="text"
              className="settings-input"
              placeholder="seu nome"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>
          
          <div className="settings-field">
            <label className="settings-label">username</label>
            <div className="settings-username-wrapper">
              <span className="settings-username-at">@</span>
              <input
                type="text"
                className="settings-input settings-input-username"
                placeholder="username"
                value={username}
                onChange={handleUsernameChange}
                maxLength={20}
              />
            </div>
            <span className="settings-hint">apenas letras, números e underscores</span>
            {usernameError && <span className="settings-error">{usernameError}</span>}
          </div>
        </section>
        
        {/* About */}
        <section className="settings-section">
          <h2 className="settings-section-title">sobre você</h2>
          
          <div className="settings-field">
            <label className="settings-label">situação</label>
            <select 
              className="settings-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">prefiro não dizer</option>
              <option value="Solteiro">solteiro</option>
              <option value="Solteira">solteira</option>
              <option value="Namorando">namorando</option>
              <option value="Casado">casado</option>
              <option value="Casada">casada</option>
              <option value="Divorciado">divorciado</option>
              <option value="Divorciada">divorciada</option>
              <option value="Viúvo">viúvo</option>
              <option value="Viúva">viúva</option>
              <option value="É complicado">é complicado</option>
            </select>
          </div>
          
          <div className="settings-field">
            <label className="settings-label">profissão</label>
            <input
              type="text"
              className="settings-input"
              placeholder="o que você faz?"
              value={profession}
              onChange={e => setProfession(e.target.value)}
              maxLength={30}
            />
          </div>
          
          <div className="settings-field">
            <label className="settings-label">localização</label>
            <input
              type="text"
              className="settings-input"
              placeholder="onde você mora?"
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={30}
            />
          </div>
        </section>
        
        {/* Danger */}
        <section className="settings-danger">
          <button 
            className="settings-logout-btn" 
            onClick={() => setShowLogoutConfirm(true)}
          >
            sair da conta
          </button>
        </section>
      </div>

      {/* Modals */}
      {showLogoutConfirm && (
        <ConfirmModal
          message="sair da conta?"
          confirmText="sair"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showUnsavedConfirm && (
        <ConfirmModal
          message="você tem alterações não salvas. deseja sair assim mesmo?"
          confirmText="sair"
          onConfirm={confirmLeave}
          onCancel={() => setShowUnsavedConfirm(false)}
        />
      )}
    </div>
  )
}

// === Confirm Modal ===
function ConfirmModal({ message, confirmText, onConfirm, onCancel }) {
  return (
    <div className="confirm-modal" onClick={onCancel}>
      <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>
            cancelar
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// === Icons ===
function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
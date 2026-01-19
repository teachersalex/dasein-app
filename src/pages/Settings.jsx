import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { storage } from '../lib/firebase'
import './Settings.css'

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
      showToast('Selecione uma imagem válida', 'error')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem muito grande (máx. 5MB)', 'error')
      return
    }
    
    setUploadingAvatar(true)
    
    try {
      // Resize image
      const resized = await resizeImage(file, 400)
      
      // ⚠️ CRITICAL - formato bate com Storage rules: avatars/{uid}_*
      const fileName = `avatars/${user.uid}_${Date.now()}.jpg`
      const storageRef = ref(storage, fileName)
      await uploadBytes(storageRef, resized)
      
      const photoURL = await getDownloadURL(storageRef)
      
      // Update profile
      await updateUserProfile(user.uid, { photoURL })
      setProfile({ ...profile, photoURL })
      
      showToast('Foto atualizada!', 'success')
    } catch (error) {
      console.error('Upload error:', error)
      showToast('Erro ao enviar foto', 'error')
    }
    
    setUploadingAvatar(false)
    e.target.value = ''
  }

  async function handleSave() {
    if (!displayName.trim()) {
      showToast('Nome é obrigatório', 'error')
      return
    }
    
    if (username.length < 3) {
      showToast('Username deve ter pelo menos 3 caracteres', 'error')
      return
    }
    
    // Check username availability
    if (username !== originalData.username) {
      const taken = await isUsernameTaken(username)
      if (taken) {
        setUsernameError('Username já está em uso')
        showToast('Username já está em uso', 'error')
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
      showToast('Perfil atualizado!', 'success')
    } else {
      showToast('Erro ao salvar', 'error')
    }
    
    setSaving(false)
  }

  async function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
      await logout()
      navigate('/')
    }
  }

  function handleBack() {
    if (hasChanges) {
      if (confirm('Você tem alterações não salvas. Deseja sair mesmo assim?')) {
        navigate('/profile')
      }
    } else {
      navigate('/profile')
    }
  }

  if (!profile) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="settings-page fade-in">
      <header className="page-header">
        <button className="btn btn-ghost" onClick={handleBack}>
          <BackIcon /> Voltar
        </button>
        <span className="page-header-title">Editar perfil</span>
        <button 
          className="btn" 
          style={{ padding: '8px 20px' }}
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </header>
      
      <div className="settings-content">
        {/* Avatar */}
        <section className="avatar-section">
          <label className="avatar-wrapper">
            <div className="avatar avatar-xl">
              {uploadingAvatar ? (
                <div className="spinner" />
              ) : profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} />
              ) : (
                profile.displayName?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="avatar-overlay">
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
          <span className="avatar-hint">Toque para alterar</span>
        </section>
        
        {/* Info */}
        <section className="form-section">
          <h2 className="section-title">Informações</h2>
          
          <div className="field">
            <label className="field-label">Nome</label>
            <input
              type="text"
              className="input-box"
              placeholder="Seu nome"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>
          
          <div className="field">
            <label className="field-label">Username</label>
            <div className="username-input-wrapper">
              <span className="username-at">@</span>
              <input
                type="text"
                className="input-box"
                style={{ paddingLeft: 32 }}
                placeholder="username"
                value={username}
                onChange={handleUsernameChange}
                maxLength={20}
              />
            </div>
            <span className="field-hint">Apenas letras, números e underscores</span>
            {usernameError && <span className="field-error">{usernameError}</span>}
          </div>
        </section>
        
        {/* About */}
        <section className="form-section">
          <h2 className="section-title">Sobre você</h2>
          
          <div className="field">
            <label className="field-label">Situação</label>
            <select 
              className="select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">Prefiro não dizer</option>
              <option value="Solteiro">Solteiro</option>
              <option value="Solteira">Solteira</option>
              <option value="Namorando">Namorando</option>
              <option value="Casado">Casado</option>
              <option value="Casada">Casada</option>
              <option value="Divorciado">Divorciado</option>
              <option value="Divorciada">Divorciada</option>
              <option value="Viúvo">Viúvo</option>
              <option value="Viúva">Viúva</option>
              <option value="É complicado">É complicado</option>
            </select>
          </div>
          
          <div className="field">
            <label className="field-label">Profissão</label>
            <input
              type="text"
              className="input-box"
              placeholder="O que você faz?"
              value={profession}
              onChange={e => setProfession(e.target.value)}
              maxLength={30}
            />
          </div>
          
          <div className="field">
            <label className="field-label">Localização</label>
            <input
              type="text"
              className="input-box"
              placeholder="Onde você mora?"
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={30}
            />
          </div>
        </section>
        
        {/* Danger zone */}
        <section className="danger-zone">
          <button className="btn btn-danger btn-full" onClick={handleLogout}>
            Sair da conta
          </button>
        </section>
      </div>
    </div>
  )
}

// 🔒 AVATAR - maxSize=400 é padrão do app, não alterar sem testar
function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
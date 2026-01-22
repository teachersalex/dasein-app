/*
 * LandingSteps.jsx — Componentes visuais da jornada de entrada
 * 
 * Só JSX, zero lógica. Toda lógica está em Landing.jsx.
 * Cada step recebe props e renderiza.
 */

// === Hero (tela inicial) ===

export function HeroStep({ onInvite, onLogin, loading, error }) {
  return (
    <>
      <h1 className="landing-logo">Dasein</h1>
      
      <div className="marquee-container">
        <div className="marquee">
          <MarqueeContent />
          <MarqueeContent />
        </div>
      </div>
      
      <div className="landing-actions">
        <button 
          className="landing-invite" 
          onClick={onInvite}
          disabled={loading}
        >
          {loading ? 'validando...' : 'tenho um convite'}
        </button>
        
        <button className="landing-link" onClick={onLogin}>
          já tenho conta
        </button>
      </div>
      
      {error && <p className="landing-error">{error}</p>}
    </>
  )
}

function MarqueeContent() {
  return (
    <div className="marquee-text">
      <span>guarde seus momentos</span>
      <span className="separator" />
      <span>mostre seu estilo</span>
      <span className="separator" />
      <span>conte suas histórias</span>
      <span className="separator" />
      <span>keep your moments</span>
      <span className="separator" />
      <span>show your style</span>
      <span className="separator" />
      <span>tell your stories</span>
      <span className="separator" />
    </div>
  )
}

// === Code (input do código de convite) ===

export function CodeStep({ 
  code, 
  onChange, 
  onSubmit, 
  onBack, 
  loading, 
  error,
  inputRef 
}) {
  const isComplete = code.length === 5
  
  return (
    <div className="landing-form">
      <button className="landing-back" onClick={onBack}>
        ← voltar
      </button>
      
      <h1 className="landing-logo small">Dasein</h1>
      <p className="landing-subtitle">digite seu código</p>
      
      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="landing-input code"
          placeholder="XXXXX"
          value={code}
          onChange={onChange}
          maxLength={5}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
        />
        
        {error && <p className="landing-error">{error}</p>}
        
        <button 
          type="submit" 
          className="landing-button"
          disabled={!isComplete || loading}
        >
          {loading ? 'validando...' : 'continuar'}
        </button>
      </form>
    </div>
  )
}

// === Signup (criar conta) ===

export function SignupStep({ 
  email, 
  password, 
  onEmailChange, 
  onPasswordChange, 
  onSubmit, 
  loading, 
  error,
  inputRef 
}) {
  const canSubmit = email && password.length >= 6
  
  return (
    <div className="landing-form">
      <h1 className="landing-logo small">Dasein</h1>
      <p className="landing-subtitle">criar conta</p>
      
      <form onSubmit={onSubmit}>
        <div className="landing-field">
          <label>email</label>
          <input
            ref={inputRef}
            type="email"
            className="landing-input"
            placeholder="seu@email.com"
            value={email}
            onChange={onEmailChange}
            required
            autoComplete="email"
          />
        </div>
        
        <div className="landing-field">
          <label>senha</label>
          <input
            type="password"
            className="landing-input"
            placeholder="mínimo 6 caracteres"
            value={password}
            onChange={onPasswordChange}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        
        {error && <p className="landing-error">{error}</p>}
        
        <button 
          type="submit" 
          className="landing-button"
          disabled={loading || !canSubmit}
        >
          {loading ? 'criando...' : 'criar conta'}
        </button>
      </form>
    </div>
  )
}

// === Login (entrar) ===

export function LoginStep({ 
  email, 
  password, 
  onEmailChange, 
  onPasswordChange, 
  onSubmit, 
  onBack,
  loading, 
  error,
  inputRef 
}) {
  const canSubmit = email && password
  
  return (
    <div className="landing-form">
      <button className="landing-back" onClick={onBack}>
        ← voltar
      </button>
      
      <h1 className="landing-logo small">Dasein</h1>
      <p className="landing-subtitle">entrar</p>
      
      <form onSubmit={onSubmit}>
        <div className="landing-field">
          <label>email</label>
          <input
            ref={inputRef}
            type="email"
            className="landing-input"
            placeholder="seu@email.com"
            value={email}
            onChange={onEmailChange}
            required
            autoComplete="email"
          />
        </div>
        
        <div className="landing-field">
          <label>senha</label>
          <input
            type="password"
            className="landing-input"
            placeholder="sua senha"
            value={password}
            onChange={onPasswordChange}
            required
            autoComplete="current-password"
          />
        </div>
        
        {error && <p className="landing-error">{error}</p>}
        
        <button 
          type="submit" 
          className="landing-button"
          disabled={loading || !canSubmit}
        >
          {loading ? 'entrando...' : 'entrar'}
        </button>
      </form>
    </div>
  )
}

// === Profile (configurar perfil) ===

export function ProfileStep({
  displayName,
  username,
  usernameStatus,
  avatarPreview,
  onDisplayNameChange,
  onUsernameChange,
  onAvatarSelect,
  onAvatarRemove,
  onSubmit,
  loading,
  error
}) {
  const canSubmit = username.length >= 3 && usernameStatus.valid === true
  
  return (
    <div className="landing-form">
      <h1 className="landing-logo small">Dasein</h1>
      <p className="landing-subtitle">seu perfil</p>
      
      <form onSubmit={onSubmit}>
        <label className="landing-avatar">
          {avatarPreview ? (
            <img src={avatarPreview} alt="" />
          ) : (
            <CameraIcon />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onAvatarSelect}
          />
        </label>
        <p className="landing-avatar-hint">
          {avatarPreview ? (
            <button type="button" onClick={onAvatarRemove}>
              remover foto
            </button>
          ) : (
            'toque para adicionar foto'
          )}
        </p>
        
        <div className="landing-field">
          <label>nome</label>
          <input
            type="text"
            className="landing-input"
            placeholder="como quer ser chamado"
            value={displayName}
            onChange={onDisplayNameChange}
            autoComplete="name"
          />
        </div>
        
        <div className="landing-field">
          <label>username</label>
          <div className="landing-username-wrap">
            <span className="landing-username-at">@</span>
            <input
              type="text"
              className="landing-input username"
              placeholder="username"
              value={username}
              onChange={onUsernameChange}
              required
              minLength={3}
              autoComplete="username"
            />
          </div>
          {usernameStatus.text && (
            <span className={`landing-field-status ${
              usernameStatus.valid === true ? 'valid' : 
              usernameStatus.valid === false ? 'invalid' : ''
            }`}>
              {usernameStatus.text}
            </span>
          )}
        </div>
        
        {error && <p className="landing-error">{error}</p>}
        
        <button 
          type="submit" 
          className="landing-button"
          disabled={loading || !canSubmit}
        >
          {loading ? 'finalizando...' : 'começar'}
        </button>
      </form>
    </div>
  )
}

// === Ícone ===

function CameraIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

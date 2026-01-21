import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`landing ${mounted ? 'mounted' : ''}`}>
      <div className="landing-bg"></div>
      <div className="landing-gradient"></div>
      
      <div className="landing-content">
        <h1 className="landing-logo">Dasein</h1>
        
        <div className="marquee-container">
          <div className="marquee">
            <div className="marquee-text">
              <span>guarde seus momentos</span>
              <span className="separator"></span>
              <span>mostre seu estilo</span>
              <span className="separator"></span>
              <span>conte suas histórias</span>
              <span className="separator"></span>
              <span>keep your moments</span>
              <span className="separator"></span>
              <span>show your style</span>
              <span className="separator"></span>
              <span>tell your stories</span>
              <span className="separator"></span>
            </div>
            <div className="marquee-text">
              <span>guarde seus momentos</span>
              <span className="separator"></span>
              <span>mostre seu estilo</span>
              <span className="separator"></span>
              <span>conte suas histórias</span>
              <span className="separator"></span>
              <span>keep your moments</span>
              <span className="separator"></span>
              <span>show your style</span>
              <span className="separator"></span>
              <span>tell your stories</span>
              <span className="separator"></span>
            </div>
          </div>
        </div>
        
        <div className="landing-actions">
          <Link to="/auth" className="landing-invite">
            tenho um convite
          </Link>
          
          <Link to="/login" className="landing-link">
            já tenho conta
          </Link>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

// ✅ SAFE - página inicial estática
const words = [
  'existir',
  'to exist',
  '存在する',
  'exister',
  'existieren',
  'esistere',
  '존재하다'
]

export default function Landing() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      
      setTimeout(() => {
        setCurrentIndex(i => (i + 1) % words.length)
        setIsTransitioning(false)
      }, 500)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`landing ${mounted ? 'mounted' : ''}`}>
      <div className="landing-content">
        <h1 className="landing-logo">Dasein</h1>
        
        <div className="landing-word-container">
          <span className={`landing-word ${isTransitioning ? 'exit' : ''}`}>
            {words[currentIndex]}
          </span>
        </div>
        
        <div className="landing-actions">
          <Link to="/auth" className="btn">
            Tenho um convite
          </Link>
          
          <Link to="/login" className="landing-link">
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  )
}
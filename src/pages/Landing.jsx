import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

const words = [
  'existir',
  'to exist',
  '存在する',
  'exister',
  'existieren',
  'esistere',
  '존재하다',
  'existir'
]

export default function Landing() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      
      setTimeout(() => {
        setCurrentIndex(i => (i + 1) % words.length)
        setIsTransitioning(false)
      }, 800)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="landing">
      <h1 className="landing-logo fade-in">Dasein</h1>
      
      <div className="landing-word-container fade-in" style={{ animationDelay: '0.3s' }}>
        <span className={`landing-word ${isTransitioning ? 'exit' : 'active'}`}>
          {words[currentIndex]}
        </span>
      </div>
      
      <Link to="/auth" className="btn fade-in" style={{ animationDelay: '0.6s' }}>
        Tenho um convite
      </Link>
      
      <Link to="/login" className="landing-link fade-in" style={{ animationDelay: '0.8s' }}>
        Já tenho conta
      </Link>
    </div>
  )
}

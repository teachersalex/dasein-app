import { useState } from 'react'

export default function FadeImage({ src, alt = '', className = '', style = {} }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}
      onLoad={() => setLoaded(true)}
    />
  )
}

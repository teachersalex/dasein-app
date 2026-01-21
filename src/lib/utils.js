/*
 * utils.js — Funções utilitárias do Dasein
 * 
 * Centraliza funções duplicadas identificadas na auditoria:
 * - formatTime (estava em 5+ arquivos)
 */

/**
 * Formata timestamp para exibição relativa
 * @param {number|Date|{toMillis: function}} timestamp 
 * @returns {string}
 */
export function formatTime(timestamp) {
  if (!timestamp) return ''
  
  // Handle Firestore Timestamp
  const ms = typeof timestamp === 'number' 
    ? timestamp 
    : timestamp?.toMillis?.() || new Date(timestamp).getTime()
  
  const date = new Date(ms)
  const now = new Date()
  const diff = now - date
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  
  return date.toLocaleDateString('pt-BR', { 
    day: 'numeric', 
    month: 'short' 
  })
}

/**
 * Formata timestamp com prefixo "há"
 * @param {number|Date|{toMillis: function}} timestamp 
 * @returns {string}
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return ''
  
  const ms = typeof timestamp === 'number' 
    ? timestamp 
    : timestamp?.toMillis?.() || new Date(timestamp).getTime()
  
  const date = new Date(ms)
  const now = new Date()
  const diff = now - date
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes}min`
  if (hours < 24) return `há ${hours}h`
  if (days < 7) return `há ${days}d`
  
  return date.toLocaleDateString('pt-BR')
}

/**
 * Redimensiona imagem mantendo proporção
 * @param {File} file 
 * @param {number} maxSize 
 * @param {function} callback 
 */
export function resizeImage(file, maxSize, callback) {
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
      
      canvas.toBlob(callback, 'image/jpeg', 0.9)
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

// Definição dos filtros
export const FILTERS = [
  { name: 'Original', id: 'original', css: '' },
  { name: 'Noir', id: 'noir', css: 'grayscale(100%) contrast(1.15)' },
  { name: 'Silence', id: 'silence', css: 'saturate(0.5) brightness(1.05) contrast(0.95)' },
  { name: 'Shadow', id: 'shadow', css: 'contrast(1.3) brightness(0.95) saturate(0.85)' },
  { name: 'Ember', id: 'ember', css: 'sepia(20%) saturate(1.15) brightness(1.05)' }
]

// Aplica filtro via Canvas (CSS filter)
export function applyFilter(photoData, filter) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      
      const ctx = canvas.getContext('2d')
      ctx.filter = filter.css || 'none'
      ctx.drawImage(img, 0, 0)
      
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.src = photoData
  })
}

// Get filter by ID
export function getFilterById(id) {
  return FILTERS.find(f => f.id === id) || FILTERS[0]
}

// Get filter CSS class
export function getFilterClass(filterId) {
  return `filter-${filterId}`
}

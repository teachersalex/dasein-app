// ==========================================
// DASEIN FILTERS - WebGL Engine
// ==========================================

export const FILTERS = [
  { 
    name: 'Original', 
    id: 'original',
    settings: null
  },
  { 
    name: 'Noir', 
    id: 'noir',
    settings: {
      saturation: 0,
      contrast: 1.2,
      brightness: 1.0,
      warmth: 0,
      shadowLift: 0.05,
      vignette: 0.35
    }
  },
  { 
    name: 'Silence', 
    id: 'silence',
    settings: {
      saturation: 0.12,
      contrast: 0.92,
      brightness: 1.08,
      warmth: -0.08,
      shadowLift: 0.12,
      vignette: 0.15
    }
  },
  { 
    name: 'Shadow', 
    id: 'shadow',
    settings: {
      saturation: 0.9,
      contrast: 1.35,
      brightness: 0.92,
      warmth: 0.08,
      shadowLift: -0.08,
      vignette: 0.45
    }
  },
  { 
    name: 'Ember', 
    id: 'ember',
    settings: {
      saturation: 1.1,
      contrast: 1.08,
      brightness: 1.05,
      warmth: 0.18,
      shadowLift: 0.02,
      vignette: 0.2
    }
  }
]

// WebGL context cache
let glCanvas = null
let gl = null
let program = null
let positionBuffer = null
let texCoordBuffer = null

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  
  uniform sampler2D u_image;
  uniform float u_saturation;
  uniform float u_contrast;
  uniform float u_brightness;
  uniform float u_warmth;
  uniform float u_shadowLift;
  uniform float u_vignette;
  uniform vec2 u_resolution;
  
  varying vec2 v_texCoord;
  
  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    
    // Luminance
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Saturation
    color.rgb = mix(vec3(lum), color.rgb, u_saturation);
    
    // Contrast
    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
    
    // Brightness
    color.rgb *= u_brightness;
    
    // Warmth
    if (u_warmth > 0.0) {
      color.r += u_warmth * 0.3;
      color.b -= u_warmth * 0.2;
    } else {
      color.r += u_warmth * 0.2;
      color.b -= u_warmth * 0.3;
    }
    
    // Shadow lift
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
    color.rgb += u_shadowLift * shadowMask;
    
    // Vignette
    vec2 uv = v_texCoord;
    float aspectRatio = u_resolution.x / u_resolution.y;
    vec2 center = uv - 0.5;
    center.x *= aspectRatio;
    float dist = length(center);
    float vig = 1.0 - smoothstep(0.3, 0.9, dist) * u_vignette;
    color.rgb *= vig;
    
    // Clamp
    color.rgb = clamp(color.rgb, 0.0, 1.0);
    
    gl_FragColor = color;
  }
`

function initWebGL() {
  if (gl) return true
  
  glCanvas = document.createElement('canvas')
  gl = glCanvas.getContext('webgl', { preserveDrawingBuffer: true }) || 
       glCanvas.getContext('experimental-webgl', { preserveDrawingBuffer: true })
  
  if (!gl) {
    console.warn('WebGL not available')
    return false
  }
  
  // Create vertex shader
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)
  gl.shaderSource(vertexShader, VERTEX_SHADER)
  gl.compileShader(vertexShader)
  
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader))
    return false
  }
  
  // Create fragment shader
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(fragmentShader, FRAGMENT_SHADER)
  gl.compileShader(fragmentShader)
  
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader))
    return false
  }
  
  // Create program
  program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    return false
  }
  
  // Position buffer
  positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1, 1,   1, -1,   1, 1
  ]), gl.STATIC_DRAW)
  
  // TexCoord buffer
  texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 1,  1, 1,  0, 0,
    0, 0,  1, 1,  1, 0
  ]), gl.STATIC_DRAW)
  
  return true
}

export function applyFilter(photoData, filter) {
  return new Promise((resolve) => {
    // No filter = return original
    if (!filter.settings) {
      resolve(photoData)
      return
    }
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      if (!initWebGL()) {
        // Fallback - return original
        resolve(photoData)
        return
      }
      
      const s = filter.settings
      
      // Set canvas size
      glCanvas.width = img.width
      glCanvas.height = img.height
      gl.viewport(0, 0, img.width, img.height)
      
      // Use program
      gl.useProgram(program)
      
      // Position attribute
      const posLoc = gl.getAttribLocation(program, 'a_position')
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
      
      // TexCoord attribute
      const texLoc = gl.getAttribLocation(program, 'a_texCoord')
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
      gl.enableVertexAttribArray(texLoc)
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)
      
      // Create texture
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      
      // Set uniforms
      gl.uniform1f(gl.getUniformLocation(program, 'u_saturation'), s.saturation)
      gl.uniform1f(gl.getUniformLocation(program, 'u_contrast'), s.contrast)
      gl.uniform1f(gl.getUniformLocation(program, 'u_brightness'), s.brightness)
      gl.uniform1f(gl.getUniformLocation(program, 'u_warmth'), s.warmth)
      gl.uniform1f(gl.getUniformLocation(program, 'u_shadowLift'), s.shadowLift)
      gl.uniform1f(gl.getUniformLocation(program, 'u_vignette'), s.vignette)
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), img.width, img.height)
      
      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      // Export
      const result = glCanvas.toDataURL('image/jpeg', 0.92)
      
      // Cleanup
      gl.deleteTexture(texture)
      
      resolve(result)
    }
    
    img.onerror = () => {
      console.error('Image load failed')
      resolve(photoData)
    }
    
    img.src = photoData
  })
}

// For grid/post display
export function getFilterClass(filterId) {
  return `filter-${filterId}`
}

export function getFilterById(id) {
  return FILTERS.find(f => f.id === id) || FILTERS[0]
}
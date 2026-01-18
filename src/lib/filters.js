// ==========================================
// DASEIN FILTERS - Advanced WebGL Engine
// ==========================================

export const FILTERS = [
  { 
    name: 'Original', 
    id: 'original',
    settings: null
  },
  { 
    name: 'Grain', 
    id: 'grain',
    settings: {
      saturation: 1.0,
      contrast: 1.08,
      brightness: 1.02,
      warmth: 0.03,
      shadowLift: 0.02,
      highlightCompress: 0.02,
      vignette: 0.15,
      grain: 0.12,
      grainSize: 1.5
    }
  },
  { 
    name: 'Portra', 
    id: 'portra',
    settings: {
      saturation: 0.92,
      contrast: 0.95,
      brightness: 1.06,
      warmth: 0.08,
      shadowLift: 0.08,
      highlightCompress: 0.05,
      vignette: 0.12,
      grain: 0.06,
      grainSize: 1.2,
      // Portra-specific: soft highlights, warm shadows
      toneMapping: 'portra'
    }
  },
  { 
    name: 'Velvia', 
    id: 'velvia',
    settings: {
      saturation: 1.35,
      contrast: 1.25,
      brightness: 0.98,
      warmth: 0.02,
      shadowLift: -0.05,
      highlightCompress: 0.08,
      vignette: 0.2,
      grain: 0.04,
      grainSize: 1.0,
      // Velvia: punchy, saturated
      toneMapping: 'velvia'
    }
  },
  { 
    name: 'Noir', 
    id: 'noir',
    settings: {
      saturation: 0,
      contrast: 1.25,
      brightness: 1.0,
      warmth: 0,
      shadowLift: 0.03,
      highlightCompress: 0.1,
      vignette: 0.4,
      grain: 0.15,
      grainSize: 1.8
    }
  },
  { 
    name: 'Silence', 
    id: 'silence',
    settings: {
      saturation: 0.15,
      contrast: 0.9,
      brightness: 1.1,
      warmth: -0.05,
      shadowLift: 0.15,
      highlightCompress: 0.02,
      vignette: 0.1,
      grain: 0.08,
      grainSize: 1.3
    }
  },
  { 
    name: 'Ember', 
    id: 'ember',
    settings: {
      saturation: 1.1,
      contrast: 1.1,
      brightness: 1.02,
      warmth: 0.2,
      shadowLift: 0.0,
      highlightCompress: 0.05,
      vignette: 0.25,
      grain: 0.05,
      grainSize: 1.0
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
  precision highp float;
  
  uniform sampler2D u_image;
  uniform float u_saturation;
  uniform float u_contrast;
  uniform float u_brightness;
  uniform float u_warmth;
  uniform float u_shadowLift;
  uniform float u_highlightCompress;
  uniform float u_vignette;
  uniform float u_grain;
  uniform float u_grainSize;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform int u_toneMapping; // 0 = none, 1 = portra, 2 = velvia
  
  varying vec2 v_texCoord;
  
  // Noise function for grain
  float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  // Improved noise with size control
  float noise(vec2 uv, float size) {
    vec2 scaled = uv * u_resolution / size;
    return random(scaled + u_time);
  }
  
  // Soft curve for highlights
  float softHighlight(float x, float compress) {
    float threshold = 1.0 - compress;
    if (x > threshold) {
      float excess = x - threshold;
      return threshold + excess * (1.0 - excess / (2.0 * compress));
    }
    return x;
  }
  
  // Portra-style tone curve
  vec3 portraTone(vec3 color) {
    // Lift shadows warmly
    vec3 shadows = vec3(0.02, 0.01, -0.01);
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float shadowMask = 1.0 - smoothstep(0.0, 0.4, lum);
    color += shadows * shadowMask;
    
    // Soft highlight rolloff
    color.r = softHighlight(color.r, 0.15);
    color.g = softHighlight(color.g, 0.12);
    color.b = softHighlight(color.b, 0.1);
    
    return color;
  }
  
  // Velvia-style tone curve
  vec3 velviaTone(vec3 color) {
    // S-curve for punch
    color = color * color * (3.0 - 2.0 * color);
    
    // Boost saturation in midtones
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float midtoneMask = 1.0 - abs(lum - 0.5) * 2.0;
    vec3 saturated = mix(vec3(lum), color, 1.0 + 0.3 * midtoneMask);
    
    return saturated;
  }
  
  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    
    // Luminance
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Saturation
    color.rgb = mix(vec3(lum), color.rgb, u_saturation);
    
    // Contrast (around midpoint)
    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
    
    // Brightness
    color.rgb *= u_brightness;
    
    // Warmth (color temperature shift)
    if (u_warmth > 0.0) {
      color.r += u_warmth * 0.25;
      color.g += u_warmth * 0.1;
      color.b -= u_warmth * 0.2;
    } else {
      color.r += u_warmth * 0.2;
      color.b -= u_warmth * 0.25;
    }
    
    // Shadow lift (affects darks only)
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
    color.rgb += u_shadowLift * shadowMask;
    
    // Highlight compression (affects brights only)
    color.r = softHighlight(color.r, u_highlightCompress);
    color.g = softHighlight(color.g, u_highlightCompress);
    color.b = softHighlight(color.b, u_highlightCompress);
    
    // Tone mapping (film emulation)
    if (u_toneMapping == 1) {
      color.rgb = portraTone(color.rgb);
    } else if (u_toneMapping == 2) {
      color.rgb = velviaTone(color.rgb);
    }
    
    // Vignette (elliptical, smooth)
    vec2 uv = v_texCoord;
    float aspectRatio = u_resolution.x / u_resolution.y;
    vec2 center = uv - 0.5;
    center.x *= aspectRatio;
    float dist = length(center);
    float vig = 1.0 - smoothstep(0.2, 1.0, dist) * u_vignette;
    color.rgb *= vig;
    
    // Film grain (organic, luminance-aware)
    if (u_grain > 0.0) {
      float grainNoise = noise(v_texCoord, u_grainSize) - 0.5;
      
      // Grain more visible in midtones, less in shadows/highlights
      float grainMask = 1.0 - abs(lum - 0.5) * 1.5;
      grainMask = max(grainMask, 0.3);
      
      color.rgb += grainNoise * u_grain * grainMask;
    }
    
    // Final clamp
    color.rgb = clamp(color.rgb, 0.0, 1.0);
    
    gl_FragColor = color;
  }
`

function initWebGL() {
  if (gl) return true
  
  glCanvas = document.createElement('canvas')
  gl = glCanvas.getContext('webgl', { 
    preserveDrawingBuffer: true,
    premultipliedAlpha: false
  }) || glCanvas.getContext('experimental-webgl', { 
    preserveDrawingBuffer: true,
    premultipliedAlpha: false
  })
  
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
  
  // Position buffer (fullscreen quad)
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
      gl.uniform1f(gl.getUniformLocation(program, 'u_highlightCompress'), s.highlightCompress || 0)
      gl.uniform1f(gl.getUniformLocation(program, 'u_vignette'), s.vignette)
      gl.uniform1f(gl.getUniformLocation(program, 'u_grain'), s.grain || 0)
      gl.uniform1f(gl.getUniformLocation(program, 'u_grainSize'), s.grainSize || 1.0)
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), Math.random() * 1000)
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), img.width, img.height)
      
      // Tone mapping mode
      let toneMode = 0
      if (s.toneMapping === 'portra') toneMode = 1
      else if (s.toneMapping === 'velvia') toneMode = 2
      gl.uniform1i(gl.getUniformLocation(program, 'u_toneMapping'), toneMode)
      
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

// For CSS preview (limited - no grain)
export function getFilterClass(filterId) {
  return `filter-${filterId}`
}

export function getFilterById(id) {
  return FILTERS.find(f => f.id === id) || FILTERS[0]
}
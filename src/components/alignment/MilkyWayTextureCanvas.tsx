import { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface MilkyWayTextureCanvasProps {
  rotMatrix: number[][]
  cx: number
  cy: number
  R: number
  width: number
  height: number
  opacity: number
  sunDirection: [number, number, number]
  moonDirection: [number, number, number]
  twilightWash: number
  moonWash: number
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D map;
  uniform mat3 rot;
  uniform vec2 resolution;
  uniform float cx;
  uniform float cy;
  uniform float R;
  uniform float opacity;
  uniform vec3 sunDir;
  uniform vec3 moonDir;
  uniform float twilightWash;
  uniform float moonWash;

  const float PI = 3.141592653589793;
  const float TWO_PI = 6.283185307179586;
  const float HALF_PI = 1.5707963267948966;

  void main() {
    // Convert to top-left pixel coordinates to match SVG/canvas layout.
    vec2 p = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
    float rx = p.x - cx;
    float ry = p.y - cy;
    float rr = rx * rx + ry * ry;

    if (rr > R * R) {
      discard;
    }

    float r = sqrt(rr);
    vec3 hor;

    if (r < 0.5) {
      hor = vec3(0.0, 0.0, 1.0);
    } else {
      float alt = HALF_PI * (1.0 - r / R);
      float cosAlt = cos(alt);
      float sinAlt = sin(alt);
      float invR = 1.0 / r;
      hor = vec3(
        cosAlt * (-ry * invR),
        cosAlt * (rx * invR),
        sinAlt
      );
    }

    vec3 eqj = rot * hor;
    float dec = asin(clamp(eqj.z, -1.0, 1.0));
    float ra = atan(eqj.y, eqj.x);
    if (ra < 0.0) ra += TWO_PI;

    float u = 0.5 - ra / TWO_PI;
    u = fract(u + 1.0);
    float v = (HALF_PI - dec) / PI;

    vec4 tex = texture2D(map, vec2(u, v));

    float localVisibility = 1.0;

    if (twilightWash > 0.0001) {
      float sunDot = clamp(dot(normalize(hor), normalize(sunDir)), -1.0, 1.0);
      float sunAng = acos(sunDot);
      float sunWide = exp(-0.5 * pow(sunAng / 0.85, 2.0));
      float sunCore = exp(-0.5 * pow(sunAng / 0.22, 2.0));
      float sunScatter = clamp(0.65 * sunWide + 0.35 * sunCore, 0.0, 1.0);
      localVisibility -= 0.85 * twilightWash * sunScatter;
    }

    if (moonWash > 0.0001) {
      float moonDot = clamp(dot(normalize(hor), normalize(moonDir)), -1.0, 1.0);
      float moonAng = acos(moonDot);
      float moonKernel = exp(-0.5 * pow(moonAng / 0.33, 2.0));
      localVisibility -= 0.75 * moonWash * moonKernel;
    }

    localVisibility = clamp(localVisibility, 0.05, 1.0);
    gl_FragColor = vec4(tex.rgb * localVisibility, opacity * localVisibility);
  }
`

interface GlState {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  material: THREE.ShaderMaterial
  geometry: THREE.BufferGeometry
  sunVec: THREE.Vector3
  moonVec: THREE.Vector3
  renderWidth: number
  renderHeight: number
}

const INTERNAL_RENDER_SCALE = 0.75

let sharedTexture: THREE.Texture | null = null
let sharedTexturePromise: Promise<THREE.Texture> | null = null

function loadTexture(): Promise<THREE.Texture> {
  if (sharedTexture) return Promise.resolve(sharedTexture)
  if (sharedTexturePromise) return sharedTexturePromise

  sharedTexturePromise = new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      `${import.meta.env.BASE_URL}starmap_4k.jpg`,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false
        texture.needsUpdate = true
        sharedTexture = texture
        resolve(texture)
      },
      undefined,
      (err) => reject(err),
    )
  })

  return sharedTexturePromise
}

export default function MilkyWayTextureCanvas({
  rotMatrix, cx, cy, R, width, height, opacity,
  sunDirection, moonDirection, twilightWash, moonWash,
}: MilkyWayTextureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<GlState | null>(null)
  const drawRef = useRef<(() => void) | null>(null)
  const propsRef = useRef({
    rotMatrix,
    cx,
    cy,
    R,
    width,
    height,
    opacity,
    sunDirection,
    moonDirection,
    twilightWash,
    moonWash,
  })

  propsRef.current = {
    rotMatrix,
    cx,
    cy,
    R,
    width,
    height,
    opacity,
    sunDirection,
    moonDirection,
    twilightWash,
    moonWash,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        map: { value: null },
        rot: { value: new THREE.Matrix3() },
        resolution: { value: new THREE.Vector2(1, 1) },
        cx: { value: 0 },
        cy: { value: 0 },
        R: { value: 1 },
        opacity: { value: 1 },
        sunDir: { value: new THREE.Vector3(0, 0, 1) },
        moonDir: { value: new THREE.Vector3(0, 0, 1) },
        twilightWash: { value: 0 },
        moonWash: { value: 0 },
      },
    })

    const quad = new THREE.Mesh(geometry, material)
    scene.add(quad)

    const state: GlState = {
      renderer,
      scene,
      camera,
      material,
      geometry,
      sunVec: new THREE.Vector3(),
      moonVec: new THREE.Vector3(),
      renderWidth: 0,
      renderHeight: 0,
    }
    glRef.current = state

    drawRef.current = () => {
      const gl = glRef.current
      if (!gl) return
      const p = propsRef.current
      if (p.width <= 0 || p.height <= 0) return
      if (!gl.material.uniforms.map.value) return

      const renderWidth = Math.max(1, Math.round(p.width * INTERNAL_RENDER_SCALE))
      const renderHeight = Math.max(1, Math.round(p.height * INTERNAL_RENDER_SCALE))
      const sx = renderWidth / p.width
      const sy = renderHeight / p.height

      if (gl.renderWidth !== renderWidth || gl.renderHeight !== renderHeight) {
        gl.renderer.setSize(renderWidth, renderHeight, false)
        gl.renderWidth = renderWidth
        gl.renderHeight = renderHeight
      }

      gl.material.uniforms.resolution.value.set(renderWidth, renderHeight)
      gl.material.uniforms.cx.value = p.cx * sx
      gl.material.uniforms.cy.value = p.cy * sy
      gl.material.uniforms.R.value = p.R * ((sx + sy) * 0.5)
      gl.material.uniforms.opacity.value = p.opacity
      gl.material.uniforms.twilightWash.value = p.twilightWash
      gl.material.uniforms.moonWash.value = p.moonWash

      gl.material.uniforms.rot.value.set(
        p.rotMatrix[0][0], p.rotMatrix[0][1], p.rotMatrix[0][2],
        p.rotMatrix[1][0], p.rotMatrix[1][1], p.rotMatrix[1][2],
        p.rotMatrix[2][0], p.rotMatrix[2][1], p.rotMatrix[2][2],
      )

      gl.sunVec.set(p.sunDirection[0], p.sunDirection[1], p.sunDirection[2])
      if (gl.sunVec.lengthSq() < 1e-8) gl.sunVec.set(0, 0, 1)
      else gl.sunVec.normalize()

      gl.moonVec.set(p.moonDirection[0], p.moonDirection[1], p.moonDirection[2])
      if (gl.moonVec.lengthSq() < 1e-8) gl.moonVec.set(0, 0, 1)
      else gl.moonVec.normalize()

      gl.material.uniforms.sunDir.value.copy(gl.sunVec)
      gl.material.uniforms.moonDir.value.copy(gl.moonVec)

      if (p.opacity <= 0.001) return
      gl.renderer.render(gl.scene, gl.camera)
    }

    let cancelled = false
    loadTexture()
      .then((texture) => {
        if (cancelled || !glRef.current) return
        glRef.current.material.uniforms.map.value = texture
        drawRef.current?.()
      })
      .catch(() => {
        // Keep charts functional if texture load fails.
      })

    return () => {
      cancelled = true
      drawRef.current = null
      glRef.current = null
      scene.remove(quad)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    drawRef.current?.()
  }, [rotMatrix, cx, cy, R, width, height, opacity, sunDirection, moonDirection, twilightWash, moonWash])

  return (
    <div style={{
      position: 'absolute',
      left: cx - R,
      top: cy - R,
      width: R * 2,
      height: R * 2,
      borderRadius: '50%',
      overflow: 'hidden',
      pointerEvents: 'none',
      opacity,
    }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: -(cx - R),
          top: -(cy - R),
          width,
          height,
        }}
      />
    </div>
  )
}

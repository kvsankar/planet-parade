import { useRef, useEffect } from 'react'

interface MilkyWayTextureCanvasProps {
  rotMatrix: number[][]
  cx: number
  cy: number
  R: number
  width: number
  height: number
  opacity: number
}

// --------------- Web Worker (inline blob) ---------------

const workerSource = `
var texPixels = null;
var texW = 0;
var texH = 0;
var TWO_PI = 2 * Math.PI;
var HALF_PI = Math.PI / 2;
var INV_PI = 1 / Math.PI;

self.onmessage = function(e) {
  var d = e.data;

  if (d.type === 'texture') {
    texPixels = new Uint8Array(d.pixels);
    texW = d.texW;
    texH = d.texH;
    return;
  }

  if (d.type === 'render') {
    if (!texPixels) return;

    var rot = d.rot;
    var cx = d.cx, cy = d.cy, R = d.R;
    var w = d.width, h = d.height;
    var seq = d.seq;

    var r00 = rot[0], r01 = rot[1], r02 = rot[2];
    var r10 = rot[3], r11 = rot[4], r12 = rot[5];
    var r20 = rot[6], r21 = rot[7], r22 = rot[8];

    var RR = R * R;
    var out = new Uint8ClampedArray(w * h * 4);
    var texStride = texW * 4;

    for (var py = 0; py < h; py++) {
      var ry = py - cy;
      for (var px = 0; px < w; px++) {
        var rx = px - cx;
        var rr = rx * rx + ry * ry;
        if (rr > RR) continue;

        var r = Math.sqrt(rr);
        var eqj_x, eqj_y, eqj_z;

        if (r < 0.5) {
          eqj_x = r02; eqj_y = r12; eqj_z = r22;
        } else {
          var alt_rad = HALF_PI * (1 - r / R);
          var cos_alt = Math.cos(alt_rad);
          var sin_alt = Math.sin(alt_rad);
          var inv_r = 1 / r;
          var hor_x = cos_alt * (-ry * inv_r);
          var hor_y = cos_alt * (rx * inv_r);
          var hor_z = sin_alt;
          eqj_x = r00 * hor_x + r01 * hor_y + r02 * hor_z;
          eqj_y = r10 * hor_x + r11 * hor_y + r12 * hor_z;
          eqj_z = r20 * hor_x + r21 * hor_y + r22 * hor_z;
        }

        var dec = Math.asin(eqj_z > 1 ? 1 : eqj_z < -1 ? -1 : eqj_z);
        var ra = Math.atan2(eqj_y, eqj_x);
        if (ra < 0) ra += TWO_PI;

        var u = 0.5 - ra / TWO_PI;
        if (u < 0) u += 1;
        var v = (HALF_PI - dec) * INV_PI;

        // Bilinear sample
        var fpx = u * texW - 0.5;
        var fpy = v * texH - 0.5;
        var x0 = fpx | 0; if (fpx < 0) x0 = x0 - 1;
        var y0 = fpy | 0; if (fpy < 0) y0 = y0 - 1;
        var fx = fpx - x0;
        var fy = fpy - y0;
        var x1 = (x0 + 1) % texW; if (x1 < 0) x1 += texW;
        var y1 = y0 + 1; if (y1 >= texH) y1 = texH - 1;
        var cx0 = x0 < 0 ? 0 : x0;
        var cy0 = y0 < 0 ? 0 : y0;

        var i00 = cy0 * texStride + cx0 * 4;
        var i10 = cy0 * texStride + x1 * 4;
        var i01 = y1 * texStride + cx0 * 4;
        var i11 = y1 * texStride + x1 * 4;

        var w00 = (1 - fx) * (1 - fy);
        var w10 = fx * (1 - fy);
        var w01 = (1 - fx) * fy;
        var w11 = fx * fy;

        var idx = (py * w + px) * 4;
        out[idx]     = texPixels[i00]     * w00 + texPixels[i10]     * w10 + texPixels[i01]     * w01 + texPixels[i11]     * w11;
        out[idx + 1] = texPixels[i00 + 1] * w00 + texPixels[i10 + 1] * w10 + texPixels[i01 + 1] * w01 + texPixels[i11 + 1] * w11;
        out[idx + 2] = texPixels[i00 + 2] * w00 + texPixels[i10 + 2] * w10 + texPixels[i01 + 2] * w01 + texPixels[i11 + 2] * w11;
        out[idx + 3] = 255;
      }
    }

    self.postMessage({ type: 'result', pixels: out.buffer, width: w, height: h, cx: cx, cy: cy, R: R, seq: seq, id: d.id }, [out.buffer]);
  }
};
`

// --------------- Shared worker + texture cache ---------------

let workerInstance: Worker | null = null
let workerRefCount = 0
let textureLoaded = false
let textureLoadPromise: Promise<void> | null = null

function acquireWorker(): Worker {
  if (!workerInstance) {
    const blob = new Blob([workerSource], { type: 'application/javascript' })
    workerInstance = new Worker(URL.createObjectURL(blob))
    textureLoaded = false
  }
  workerRefCount++
  return workerInstance
}

function releaseWorker() {
  workerRefCount--
  if (workerRefCount <= 0 && workerInstance) {
    workerInstance.terminate()
    workerInstance = null
    workerRefCount = 0
    textureLoaded = false
    textureLoadPromise = null
  }
}

function ensureTexture(worker: Worker): Promise<void> {
  if (textureLoaded) return Promise.resolve()
  if (textureLoadPromise) return textureLoadPromise

  textureLoadPromise = new Promise<void>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const off = document.createElement('canvas')
      off.width = img.width
      off.height = img.height
      const ctx = off.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, img.width, img.height)
      // Copy pixels to a transferable buffer
      const buf = imgData.data.buffer.slice(0)
      worker.postMessage(
        { type: 'texture', pixels: buf, texW: img.width, texH: img.height },
        [buf],
      )
      textureLoaded = true
      resolve()
    }
    img.onerror = () => resolve()
    img.src = `${import.meta.env.BASE_URL}starmap_4k.jpg`
  })
  return textureLoadPromise
}

// --------------- React component (thin shell) ---------------

let nextInstanceId = 0
const TWO_PI = 2 * Math.PI

export default function MilkyWayTextureCanvas({
  rotMatrix, cx, cy, R, width, height, opacity,
}: MilkyWayTextureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const seqRef = useRef(0)
  const idRef = useRef(nextInstanceId++)

  useEffect(() => {
    const worker = acquireWorker()
    let disposed = false
    const myId = idRef.current

    const onMessage = (e: MessageEvent) => {
      if (disposed) return
      const d = e.data
      if (d.type === 'result' && d.id === myId && d.seq === seqRef.current) {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Only reset dimensions when they actually change — avoids clearing
        // the buffer (setting canvas.width always clears, even to same value)
        if (canvas.width !== d.width || canvas.height !== d.height) {
          canvas.width = d.width
          canvas.height = d.height
        } else {
          ctx.clearRect(0, 0, d.width, d.height)
        }

        const imgData = new ImageData(
          new Uint8ClampedArray(d.pixels),
          d.width,
          d.height,
        )
        ctx.putImageData(imgData, 0, 0)

        // Clip to circle (putImageData ignores clip, so mask after)
        ctx.globalCompositeOperation = 'destination-in'
        ctx.beginPath()
        ctx.arc(d.cx, d.cy, d.R, 0, TWO_PI)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
      }
    }

    worker.addEventListener('message', onMessage)

    return () => {
      disposed = true
      worker.removeEventListener('message', onMessage)
      releaseWorker()
    }
  }, [])

  // Send render requests when params change
  useEffect(() => {
    if (!workerInstance || width === 0 || height === 0) return

    const seq = ++seqRef.current

    ensureTexture(workerInstance).then(() => {
      if (seq !== seqRef.current) return // stale
      const rot = [
        rotMatrix[0][0], rotMatrix[0][1], rotMatrix[0][2],
        rotMatrix[1][0], rotMatrix[1][1], rotMatrix[1][2],
        rotMatrix[2][0], rotMatrix[2][1], rotMatrix[2][2],
      ]
      workerInstance!.postMessage({
        type: 'render', rot, cx, cy, R, width, height, seq, id: idRef.current,
      })
    })
  }, [rotMatrix, cx, cy, R, width, height])

  // Circular clip div — prevents the canvas rectangle from being visible
  // outside the chart circle while waiting for the worker's destination-in mask.
  // No width/height attributes on <canvas> — React must not touch the buffer.
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
        }}
      />
    </div>
  )
}

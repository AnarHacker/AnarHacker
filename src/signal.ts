import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group,
  IcosahedronGeometry, Line, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Points, PointsMaterial, RingGeometry,
  Scene, TorusGeometry, Vector3, WireframeGeometry,
} from 'three'
import { createRenderer } from './graphics'

export interface Signal {
  setActive: (active: boolean) => void
  dispose: () => void
}

export function createSignal(stage: HTMLElement, hero: HTMLElement, compact: boolean): Signal {
  const renderer = createRenderer(false, true)
  renderer.setClearColor(0x000000, 0)
  const { domElement: canvas } = renderer
  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.1, 60)
  const assembly = new Group()
  scene.add(assembly)
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<MeshBasicMaterial | LineBasicMaterial | PointsMaterial>()

  function register<G extends BufferGeometry>(geometry: G): G {
    geometries.add(geometry)
    return geometry
  }

  function lineMaterial(color: string, opacity: number) {
    const material = new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: AdditiveBlending })
    materials.add(material)
    return material
  }

  function meshMaterial(color: string, opacity = 1) {
    const material = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 })
    materials.add(material)
    return material
  }

  const dial = new Group()
  dial.rotation.set(-0.35, -0.26, -0.37)
  assembly.add(dial)
  const metal = meshMaterial('#102b31', 0.86)
  const phosphor = meshMaterial('#a7ffe9')
  const trace = lineMaterial('#81e8da', 0.66)
  const quiet = lineMaterial('#55cbb8', 0.32)
  const hairline = lineMaterial('#50aeb7', 0.18)

  function circle(radius: number, z: number, material: LineBasicMaterial, start = 0, sweep = Math.PI * 2) {
    const vertices: number[] = []
    const samples = Math.max(10, Math.round(sweep / 0.06))
    for (let index = 0; index <= samples; index++) {
      const angle = start + index * sweep / samples
      vertices.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z)
    }
    dial.add(new Line(register(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3))), material))
  }

  function band(inner: number, outer: number, z: number, start: number, sweep: number, material: MeshBasicMaterial) {
    const object = new Mesh(register(new RingGeometry(inner, outer, 40, 1, start, sweep)), material)
    object.position.z = z
    dial.add(object)
  }

  circle(3.95, 0, hairline)
  circle(3.5, 0, trace, 0.16, 3.05)
  circle(3.5, 0, trace, 3.62, 2.42)
  circle(3.28, 0, quiet)
  circle(2.58, -0.2, trace)
  circle(2.35, -0.05, quiet)
  circle(1.68, -0.05, hairline)
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3 + 0.13
    band(2.78, 3.22, 0, angle, 0.82, metal)
    band(3.17, 3.2, 0.025, angle + 0.17, 0.49, phosphor)
    circle(2.93, 0.045, quiet, angle, 0.82)
  }

  const ticks: number[] = []
  for (let index = 0; index < 120; index++) {
    const angle = index / 120 * Math.PI * 2
    const x = Math.cos(angle)
    const y = Math.sin(angle)
    const inner = index % 10 === 0 ? 3.65 : 3.77
    ticks.push(inner * x, inner * y, 0.02, 3.88 * x, 3.88 * y, 0.02)
  }
  dial.add(new LineSegments(register(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(ticks, 3))), trace))

  const core = new Group()
  assembly.add(core)
  const body = register(new IcosahedronGeometry(1.18, 1))
  core.add(new Mesh(body, meshMaterial('#0c252b')))
  core.add(new LineSegments(register(new WireframeGeometry(body)), trace))
  core.add(new Mesh(register(new IcosahedronGeometry(0.27, 0)), phosphor))
  const circulating = new Mesh(register(new TorusGeometry(1.69, 0.014, 4, 94, 4.65)), phosphor)
  core.add(circulating)

  const dust: number[] = []
  const color: number[] = []
  const mint = new Color('#8aebdc')
  for (let index = 0; index < (compact ? 105 : 260); index++) {
    const angle = index * 2.39996323
    const variance = Math.sin(index * 9.5781) * 0.5 + 0.5
    const radius = 1.6 + (index % 97) * 0.054
    dust.push(Math.cos(angle) * radius, Math.sin(angle) * radius, variance * 4 - 2)
    color.push(mint.r * variance, mint.g * variance, mint.b * variance)
  }
  const dustMaterial = new PointsMaterial({ size: compact ? 0.045 : 0.034, depthWrite: false, opacity: 0.75, transparent: true, vertexColors: true, blending: AdditiveBlending })
  materials.add(dustMaterial)
  scene.add(new Points(register(new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute(dust, 3))
    .setAttribute('color', new Float32BufferAttribute(color, 3))), dustMaterial))

  let active = false
  let lost = false
  let frame = 0
  let last = 0
  let elapsed = 0
  let pointerX = 0
  let pointerY = 0
  let scroll = 0
  const look = new Vector3()

  function draw() {
    assembly.rotation.x = Math.sin(elapsed * 0.3) * 0.12 + scroll * 0.2
    assembly.rotation.y = Math.sin(elapsed * 0.21) * 0.16
    dial.rotation.z = -0.37 + Math.sin(elapsed * 0.37) * 0.08
    core.rotation.set(elapsed * 0.18, elapsed * 0.31, 0.45)
    circulating.rotation.set(0.55, elapsed * -0.6, 0.25)
    const distance = Math.max(12, 12.9 / Math.min(camera.aspect, 1.28))
    camera.position.set(pointerX * 0.8, pointerY * 0.6 + scroll, distance + 1.4 * scroll)
    camera.lookAt(look)
    renderer.render(scene, camera)
  }

  function tick(now: number) {
    frame = 0
    if (!active) return
    if (!last || now - last >= (compact ? 30 : 15)) {
      elapsed += last ? Math.min(now - last, 65) / 1000 : 0
      last = now
      scroll = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / hero.offsetHeight))
      draw()
    }
    frame = requestAnimationFrame(tick)
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1 : 1.4))
    renderer.setSize(width, height, false)
    if (active) draw()
  }

  function pointer(event: PointerEvent) {
    const rect = hero.getBoundingClientRect()
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * -2
  }

  const resizeObserver = new ResizeObserver(resize)
  stage.append(canvas)
  resizeObserver.observe(stage)
  if (!compact) hero.addEventListener('pointermove', pointer)
  function contextLost() {
    lost = true
    active = false
    cancelAnimationFrame(frame)
    delete stage.dataset.live
  }
  canvas.addEventListener('webglcontextlost', contextLost)
  resize()

  return {
    setActive(value) {
      if (lost || value === active) return
      active = value
      if (value) {
        stage.dataset.live = ''
        last = 0
        frame = requestAnimationFrame(tick)
      } else {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    dispose() {
      active = false
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      hero.removeEventListener('pointermove', pointer)
      canvas.removeEventListener('webglcontextlost', contextLost)
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      delete stage.dataset.live
    },
  }
}

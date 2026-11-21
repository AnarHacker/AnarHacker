import {
  AmbientLight, BoxGeometry, BufferGeometry, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DirectionalLight, EdgesGeometry, Float32BufferAttribute, FogExp2,
  Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, Raycaster, Scene, SphereGeometry, TorusGeometry,
  Vector2, Vector3, type Material, type Object3D,
} from 'three'
import { destinations, type Destination } from './destinations'
import { createRenderer } from './graphics'

export { WebGLContextError } from './graphics'

export interface Station {
  select: (destination: Destination, travel: boolean) => void
  reset: () => void
  nudge: (yaw: number, pitch: number, zoom: number) => void
  dispose: () => void
}

interface StationOptions {
  simplified: boolean
  reducedMotion: boolean
  onSelect: (destination: Destination) => void
  onReady: () => void
  onUnavailable: (reason: 'lost' | 'render', error?: unknown) => void
}

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function createStation(stage: HTMLElement, options: StationOptions): Station {
  const renderer = createRenderer(!options.simplified)
  const canvas = renderer.domElement
  const scene = new Scene()
  scene.background = new Color('#152837')
  scene.fog = new FogExp2('#152837', 0.015)
  scene.add(new AmbientLight('#bed6f3', 1.65))
  const sun = new DirectionalLight('#80f0d6', 2.5)
  sun.position.set(-15, 13, -18)
  scene.add(sun)
  const fill = new DirectionalLight('#b3bcfb', 1.65)
  fill.position.set(12, 7, 18)
  scene.add(fill)

  const camera = new PerspectiveCamera(42, 1, 0.2, 170)
  const overview = new Vector3(0, 0, -0.7)
  const target = overview.clone()
  const desiredTarget = overview.clone()
  const overviewRadius = options.simplified ? 39 : 34
  const orbit = { yaw: 0.65, pitch: 0.58, radius: overviewRadius }
  const desired = { ...orbit }
  const outline = new LineBasicMaterial({ color: '#b4e7ec', transparent: true, opacity: 0.52 })
  const metal = new MeshStandardMaterial({ color: '#557780', roughness: 0.7, metalness: 0.18 })
  const trim = new MeshStandardMaterial({ color: '#293949', roughness: 0.83 })
  const concrete = new MeshStandardMaterial({ color: '#283743', roughness: 1 })
  const glow = new MeshBasicMaterial({ color: '#b7ffe8' })
  const darkGlow = new MeshBasicMaterial({ color: '#64dfd0' })
  const guidance = new MeshBasicMaterial({ color: '#55a79c' })
  const shadow = new MeshBasicMaterial({ color: '#091221', opacity: 0.42, transparent: true, depthWrite: false })
  const boxGeometry = new BoxGeometry(1, 1, 1)
  const circleGeometry = new CircleGeometry(1, 32)
  const cylinderGeometry = new CylinderGeometry(1, 1, 1, 20)
  const rocky = seededRandom(1632)

  function mesh(parent: Object3D, geometry: BufferGeometry, material: Material, x: number, y: number, z: number) {
    const object = new Mesh(geometry, material)
    object.position.set(x, y, z)
    parent.add(object)
    return object
  }

  function box(parent: Object3D, x: number, y: number, z: number, width: number, height: number, depth: number, material: Material) {
    const object = mesh(parent, boxGeometry, material, x, y, z)
    object.scale.set(width, height, depth)
    return object
  }

  function cylinder(parent: Object3D, x: number, y: number, z: number, radius: number, height: number, material: Material) {
    const object = mesh(parent, cylinderGeometry, material, x, y, z)
    object.scale.set(radius, height, radius)
    return object
  }

  function edges(object: Mesh) {
    object.add(new LineSegments(new EdgesGeometry(object.geometry), outline))
  }

  const terrain = new PlaneGeometry(145, 145, options.simplified ? 42 : 68, options.simplified ? 42 : 68)
  terrain.rotateX(-Math.PI / 2)
  const ground = terrain.attributes.position
  const colors: number[] = []
  const dirt = new Color()
  const blueRidge = new Color('#4f5069')
  for (let index = 0; index < ground.count; index++) {
    const x = ground.getX(index)
    const z = ground.getZ(index)
    const distance = Math.hypot(x, z)
    const hills = Math.sin(x * 0.24 + z * 0.13) * 2 + Math.cos(z * 0.38 - x * 0.07) * 2
    const ridge = Math.max(0, Math.sin(x * 0.12 + 1.4) * Math.cos(z * 0.1) + 0.4) * 5
    const fade = Math.min(1, Math.max(0, (distance - 13) / 14))
    ground.setY(index, -0.28 + fade * (hills + ridge + rocky() * 1.2 - 0.8))
    dirt.set('#273c4b').lerp(blueRidge, rocky() * 0.47 + fade * 0.22)
    colors.push(dirt.r, dirt.g, dirt.b)
  }
  terrain.setAttribute('color', new Float32BufferAttribute(colors, 3))
  mesh(scene, terrain, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 0, 0, 0)

  function pathBetween(a: readonly [number, number], b: readonly [number, number]) {
    const x = b[0] - a[0]
    const z = b[1] - a[1]
    const distance = Math.hypot(x, z)
    const rotation = Math.atan2(x, z)
    const road = box(scene, (a[0] + b[0]) / 2, -0.15, (a[1] + b[1]) / 2, 0.83, 0.14, distance, trim)
    road.rotation.y = rotation
    for (let step = 1.1; step < distance; step += 1.55) {
      const lamp = box(scene, a[0] + x * step / distance + z / distance * 0.39, -0.059,
        a[1] + z * step / distance - x / distance * 0.39, 0.07, 0.05, 0.32, guidance)
      lamp.rotation.y = rotation
    }
  }

  for (const stop of Object.values(destinations)) pathBetween([0, 1], stop.position)
  cylinder(scene, 0, -0.08, 1, 1.37, 0.15, concrete)
  const centerRing = mesh(scene, new TorusGeometry(1.1, 0.032, 5, 40), guidance, 0, 0.004, 1)
  centerRing.rotation.x = Math.PI / 2
  const centerBeacon = mesh(scene, new TorusGeometry(1.65, 0.026, 5, 52, 4.9), darkGlow, 0, 0.045, 1)
  centerBeacon.rotation.x = Math.PI / 2

  const markers = new Map<Destination, Mesh>()
  const markerTargets: Mesh[] = []
  const pickGeometry = new SphereGeometry(0.78, 10, 6)
  const pickMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  const markerGeometry = new SphereGeometry(0.34, 4, 2)
  const padRing = new TorusGeometry(2.11, 0.035, 5, 36)

  for (const key of Object.keys(destinations) as Destination[]) {
    const [x, z] = destinations[key].position
    const model = new Group()
    model.position.set(x, 0, z)
    scene.add(model)
    const shade = mesh(model, circleGeometry, shadow, 0.37, -0.185, 0.37)
    shade.rotation.x = -Math.PI / 2
    shade.scale.set(2.85, 2.4, 1)
    cylinder(model, 0, -0.01, 0, 2.22, 0.24, concrete)
    mesh(model, padRing, guidance, 0, 0.12, 0).rotation.x = Math.PI / 2

    let markerHeight = 3
    if (key === 'projects') {
      cylinder(model, 0, 0.7, 0, 0.79, 1.4, trim)
      cylinder(model, 0, 0.92, 0, 0.85, 0.12, glow)
      const reflector = new Group()
      reflector.position.set(0, 1.95, 0)
      reflector.rotation.set(0.67, 0, 0.42)
      model.add(reflector)
      mesh(reflector, new SphereGeometry(1.83, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new MeshStandardMaterial({ color: '#97aeb8', metalness: 0.3, roughness: 0.56, side: 2 }), 0, 0.4, 0).scale.y = 0.43
      mesh(reflector, new TorusGeometry(1.83, 0.065, 8, 48), glow, 0, 0.39, 0).rotation.x = Math.PI / 2
      cylinder(reflector, 0, 0.65, 0, 0.052, 1.11, trim)
      mesh(reflector, new SphereGeometry(0.15, 12, 8), glow, 0, 1.18, 0)
      markerHeight = 4.05
    } else if (key === 'contact') {
      for (let level = 0; level < 4; level++) {
        const tower = box(model, 0, 0.64 + level * 0.94, 0, 1.04 - level * 0.14, 0.9, 1.04 - level * 0.14, trim)
        tower.rotation.y = level * 0.13
        edges(tower)
      }
      cylinder(model, 0, 4, 0, 0.045, 1.62, metal)
      for (const height of [3.35, 3.85]) {
        mesh(model, new TorusGeometry(height === 3.35 ? 0.59 : 0.4, 0.034, 6, 24), glow, 0, height, 0).rotation.x = Math.PI / 2
      }
      markerHeight = 5.15
    } else if (key === 'about') {
      cylinder(model, 0, 0.65, 0, 1.32, 1.06, metal)
      cylinder(model, 0, 0.7, 0, 1.34, 0.205, glow)
      mesh(model, new ConeGeometry(1.44, 0.75, 24), trim, 0, 1.55, 0)
      box(model, 0, 0.61, 1.27, 0.56, 0.92, 0.19, trim)
      markerHeight = 2.65
    } else if (key === 'achievements') {
      for (let index = 0; index < 3; index++) {
        const height = 0.92 + index * 0.41
        const pillar = box(model, (index - 1) * 0.69, height / 2 + 0.12, 0, 0.49, height, 1.03, metal)
        edges(pillar)
        box(model, (index - 1) * 0.69, height * 0.74, 0.53, 0.28, 0.068, 0.043, glow)
      }
      markerHeight = 2.65
    } else {
      box(model, 0, 0.68, 0, 2.8, 1.1, 1.7, metal)
      edges(box(model, 0, 1.43, 0, 2.9, 0.36, 1.82, trim))
      box(model, 0, 0.86, 0.861, 2.23, 0.23, 0.035, glow)
      for (const offset of [-0.93, 0.93]) box(model, offset, 0.15, 1.3, 0.45, 0.16, 0.53, trim)
      markerHeight = 2.6
    }

    const marker = mesh(model, markerGeometry, darkGlow, 0, markerHeight, 0)
    marker.rotation.y = Math.PI / 4
    markers.set(key, marker)
    const hitArea = mesh(model, pickGeometry, pickMaterial, 0, markerHeight, 0)
    hitArea.userData.destination = key
    markerTargets.push(hitArea)
  }

  let frame = 0
  let last = 0
  let disposed = false
  let rendered = false
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let drag: { id: number; x: number; y: number; originX: number; originY: number; moved: boolean } | undefined

  function render(timestamp: number) {
    frame = 0
    const amount = options.reducedMotion ? 1 : 1 - Math.exp(-Math.min(70, last ? timestamp - last : 16) / 113)
    last = timestamp
    orbit.yaw += (desired.yaw - orbit.yaw) * amount
    orbit.pitch += (desired.pitch - orbit.pitch) * amount
    orbit.radius += (desired.radius - orbit.radius) * amount
    target.lerp(desiredTarget, amount)
    const horizontal = Math.cos(orbit.pitch) * orbit.radius
    camera.position.set(
      target.x + Math.sin(orbit.yaw) * horizontal,
      target.y + Math.sin(orbit.pitch) * orbit.radius,
      target.z + Math.cos(orbit.yaw) * horizontal,
    )
    camera.lookAt(target)
    if (!options.reducedMotion) {
      centerBeacon.rotation.z = timestamp * 0.00032
      for (const marker of markers.values()) marker.rotation.y = timestamp * 0.00066
    }
    try {
      renderer.render(scene, camera)
    } catch (error) {
      options.onUnavailable('render', error)
      return
    }
    if (!rendered) {
      rendered = true
      options.onReady()
    }
    if (target.distanceToSquared(desiredTarget) > 0.0001 || Math.abs(desired.radius - orbit.radius) > 0.01 ||
        Math.abs(desired.yaw - orbit.yaw) > 0.0005 || Math.abs(desired.pitch - orbit.pitch) > 0.0005) {
      invalidate()
    } else {
      last = 0
    }
  }

  function invalidate() {
    if (!disposed && !frame) frame = requestAnimationFrame(render)
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage
    if (!width || !height) return
    renderer.setPixelRatio(options.simplified ? 1 : Math.min(devicePixelRatio, 1.5))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.fov = camera.aspect < 1.3 ? 55 : 42
    camera.updateProjectionMatrix()
    invalidate()
  }

  function resetCamera() {
    desiredTarget.copy(overview)
    desired.yaw = 0.65
    desired.pitch = 0.58
    desired.radius = overviewRadius
    invalidate()
  }

  function nudge(yaw: number, pitch: number, zoom: number) {
    desired.yaw += yaw
    desired.pitch = Math.min(1.26, Math.max(0.19, desired.pitch + pitch))
    desired.radius = Math.min(53, Math.max(9, desired.radius + zoom))
    invalidate()
  }

  function pointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      originX: event.clientX, originY: event.clientY, moved: false }
    canvas.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return
    const { clientX: x, clientY: y } = event
    if (Math.hypot(x - drag.originX, y - drag.originY) > 6) drag.moved = true
    if (!drag.moved) return
    nudge(-(x - drag.x) * 0.008, (y - drag.y) * 0.006, 0)
    drag.x = x
    drag.y = y
  }

  function pointerUp(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return
    const moved = drag.moved
    drag = undefined
    if (moved) return
    const bounds = canvas.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const target = raycaster.intersectObjects(markerTargets)[0]
    if (target) options.onSelect(target.object.userData.destination as Destination)
  }

  function clearPointer() { drag = undefined }

  function contextLost(event: Event) {
    event.preventDefault()
    options.onUnavailable('lost')
  }

  const observer = new ResizeObserver(resize)
  stage.append(canvas)
  observer.observe(stage)
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', clearPointer)
  canvas.addEventListener('lostpointercapture', clearPointer)
  canvas.addEventListener('webglcontextlost', contextLost)
  resize()

  return {
    select(destination, travel) {
      for (const [key, marker] of markers) {
        marker.material = destination === key ? glow : darkGlow
        marker.scale.setScalar(destination === key ? 1.55 : 1)
      }
      if (travel) {
        const [x, z] = destinations[destination].position
        desiredTarget.set(x, 0.8, z)
        desired.radius = options.simplified ? 15 : 13.3
        desired.pitch = 0.49
      }
      invalidate()
    },
    reset: resetCamera,
    nudge,
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      const geometries = new Set<BufferGeometry>()
      const materials = new Set<Material>([glow, darkGlow])
      scene.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          geometries.add(object.geometry)
          const material = object.material as Material | Material[]
          for (const entry of Array.isArray(material) ? material : [material]) materials.add(entry)
        }
      })
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}


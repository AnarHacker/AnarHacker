import './style.css'
import { destinations, isDestination, type Destination } from './destinations'
import { setupMotion } from './motion'
import { setupProjects } from './projects'
import type { Signal } from './signal'
import type { Station } from './station'

const dialog = document.querySelector<HTMLDialogElement>('#explorer')!
const caseStudy = document.querySelector<HTMLDialogElement>('#case-study')!
const hero = document.querySelector<HTMLElement>('.hero')!
const signalStage = document.querySelector<HTMLElement>('#signal-stage')!
const stage = document.querySelector<HTMLElement>('#world-stage')!
const status = document.querySelector<HTMLElement>('#world-status')!
const reset = document.querySelector<HTMLButtonElement>('#world-reset')!
const retry = document.querySelector<HTMLButtonElement>('#world-retry')!
const help = document.querySelector<HTMLElement>('#world-help')!
const title = document.querySelector<HTMLElement>('#destination-title')!
const description = document.querySelector<HTMLElement>('#destination-description')!
const sectionLink = document.querySelector<HTMLAnchorElement>('#destination-link')!
const stops = [...document.querySelectorAll<HTMLButtonElement>('[data-stop]')]
const simplified = matchMedia('(pointer: coarse), (max-width: 750px)')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData

setupMotion(reducedMotion)
setupProjects(caseStudy)

let current: Destination = 'about'
let station: Station | undefined
let request = 0
let travelOnLoad = false
let reloadRequired = false
let signal: Signal | undefined
let loadingSignal = false
let heroVisible = false

function canRunSignal() {
  return heroVisible && !dialog.open && !caseStudy.open && !document.hidden && !reducedMotion.matches && !saveData
}

async function updateSignal() {
  const active = canRunSignal()
  signal?.setActive(active)
  if (!active || signal || loadingSignal || signalStage.hasAttribute('data-unavailable')) return

  loadingSignal = true
  try {
    const { createSignal } = await import('./signal')
    if (!canRunSignal()) return
    signal = createSignal(signalStage, hero, simplified.matches)
    signal.setActive(true)
  } catch (error) {
    signalStage.dataset.unavailable = ''
    console.info('Steppe Station hero is using its static artwork.', error)
  } finally {
    loadingSignal = false
  }
}

if (typeof IntersectionObserver === 'function') {
  const observer = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting
    void updateSignal()
  }, { threshold: 0.08 })
  observer.observe(hero)
}

document.addEventListener('visibilitychange', () => { void updateSignal() })
caseStudy.addEventListener('close', () => { void updateSignal() })

function setStatus(message: string, loading = false) {
  status.textContent = message
  status.hidden = !message
  status.toggleAttribute('data-loading', loading)
  stage.setAttribute('aria-busy', String(loading))
}

function select(destination: Destination, travel: boolean) {
  current = destination
  if (travel) travelOnLoad = true
  const stop = destinations[destination]
  title.textContent = stop.title
  description.textContent = stop.description
  sectionLink.href = '#' + destination
  for (const button of stops) {
    button.setAttribute('aria-pressed', String(button.dataset.stop === destination))
  }
  station?.select(destination, travel)
}

function showFailure(message: string, error?: unknown, reload = false) {
  if (error) console.error('Steppe Station 3D:', error)
  stopWorld()
  reloadRequired = reload
  retry.textContent = reload ? 'Reload page' : 'Retry 3D'
  retry.hidden = false
  setStatus(message + ' The destination links below still work.')
}

async function loadWorld() {
  const attempt = ++request
  retry.hidden = true
  setStatus('Loading the 3D station…', true)
  let scene: typeof import('./station')
  try {
    scene = await import('./station')
  } catch (error) {
    if (request === attempt && dialog.open) {
      showFailure('The scene files failed to load. Reload the page to fetch a fresh build.', error, true)
    }
    return
  }
  if (request !== attempt || !dialog.open) return

  try {
    station = scene.createStation(stage, {
      simplified: simplified.matches || Boolean(saveData),
      reducedMotion: reducedMotion.matches,
      onSelect: (destination) => select(destination, true),
      onReady: () => {
        reset.hidden = false
        help.hidden = false
        stage.tabIndex = 0
        setStatus('')
      },
      onUnavailable: (reason, error) => showFailure(reason === 'lost'
        ? 'The browser lost its graphics connection. You can retry the scene.'
        : 'The 3D scene could not render. You can retry the scene.', error),
    })
    station.select(current, travelOnLoad)
  } catch (error) {
    showFailure(error instanceof scene.WebGLContextError
      ? 'WebGL 2 could not start. Check graphics acceleration or try a current browser.'
      : 'The 3D scene could not initialize. You can retry the scene.', error)
  }
}

function stopWorld() {
  request++
  station?.dispose()
  station = undefined
  reset.hidden = true
  help.hidden = true
  stage.removeAttribute('tabindex')
}

function openExplorer(destination?: Destination) {
  travelOnLoad = destination !== undefined
  select(destination ?? 'about', false)
  dialog.showModal()
  // Free the background context before allocating the explorer, including on mobile GPUs.
  signal?.dispose()
  signal = undefined
  void loadWorld()
}

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-explore], [data-destination]')) {
  if (typeof dialog.showModal === 'function') link.setAttribute('aria-haspopup', 'dialog')
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (typeof dialog.showModal !== 'function') return
    event.preventDefault()
    const destination = link.dataset.destination
    openExplorer(isDestination(destination) ? destination : undefined)
  })
}

for (const button of stops) {
  button.addEventListener('click', () => {
    if (isDestination(button.dataset.stop)) select(button.dataset.stop, true)
  })
}

const cameraKeys: Record<string, [number, number, number]> = {
  ArrowLeft: [-0.16, 0, 0], ArrowRight: [0.16, 0, 0],
  ArrowUp: [0, 0.09, 0], ArrowDown: [0, -0.09, 0],
  '+': [0, 0, -2], '=': [0, 0, -2], '-': [0, 0, 2],
}
stage.addEventListener('keydown', event => {
  if (!station || !Object.hasOwn(cameraKeys, event.key)) return
  event.preventDefault()
  station.nudge(...cameraKeys[event.key])
})

reset.addEventListener('click', () => station?.reset())
retry.addEventListener('click', () => {
  if (reloadRequired) location.reload()
  else void loadWorld()
})
dialog.addEventListener('close', () => {
  if (dialog.open) return
  stopWorld()
  void updateSignal()
})
sectionLink.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  dialog.close()
  const section = document.getElementById(current)
  if (section) {
    section.tabIndex = -1
    section.focus({ preventScroll: true })
  }
})
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    signal?.dispose()
    signal = undefined
  } else {
    void updateSignal()
  }
  if (!dialog.open) return
  stopWorld()
  void loadWorld()
})

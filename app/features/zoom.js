import { metaKey } from '../utilities/'
import { hideGridlines } from './guides'
import { ArtboardStyles } from '../components/styles.store'

const MIN_SCALE = 0.05
const MAX_SCALE = 8
const STEP = 0.1

const state = {
  active: false,
  baseTransform: 'none',
  generation: 0,
  originalBodyCursor: '',
  originalBodyTransform: '',
  originalBodyTransformOrigin: '',
  originalScroll: {left: 0, top: 0},
  originalStyleSheets: null,
  pageShowHandler: null,
  resizeObserver: null,
  scale: 1,
  selectionStash: null,
  selectorEngine: null,
  translate: {x: 0, y: 0},
  mouse: {x: 0, y: 0},
}

const clamp = value => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

const transformFor = (scale, translate = state.translate) =>
  `translate(${translate.x}px, ${translate.y}px) ${state.baseTransform === 'none' ? '' : `${state.baseTransform} `}scale(${scale})`.trim()

const selectedNodes = () =>
  state.selectorEngine ? [...state.selectorEngine.selection()] : []

const restoreSelection = nodes => {
  if (!state.selectorEngine) return

  nodes
    .filter(node => node.isConnected)
    .reverse()
    .forEach(node => state.selectorEngine.select(node))
}

const applyScale = async (nextScale, origin = state.mouse, resetTranslation = false) => {
  if (!state.active) return

  const body = document.body
  const previousScale = state.scale
  const previousTranslate = {...state.translate}
  const scrollPosition = {left: window.scrollX, top: window.scrollY}
  const rect = body.getBoundingClientRect()
  const localPoint = {
    x: (origin.x - rect.left) / previousScale,
    y: (origin.y - rect.top) / previousScale,
  }
  if (!state.selectionStash)
    state.selectionStash = selectedNodes()

  state.scale = clamp(nextScale)
  state.translate = resetTranslation
    ? {x: 0, y: 0}
    : {
        x: previousTranslate.x + localPoint.x * (previousScale - state.scale),
        y: previousTranslate.y + localPoint.y * (previousScale - state.scale),
      }
  if (state.selectorEngine && state.selectorEngine.selection().length)
    state.selectorEngine.unselect_all({silent: true})
  hideGridlines()

  body.style.transformOrigin = '0 0'
  body.style.transform = transformFor(state.scale)
  const generation = ++state.generation
  await new Promise(resolve => requestAnimationFrame(resolve))
  if (generation !== state.generation) return

  window.scrollTo({...scrollPosition, behavior: 'auto'})
  restoreSelection(state.selectionStash)
  state.selectionStash = null
}

export const zoomIn = (amount = STEP) =>
  applyScale(state.scale + amount)

export const zoomOut = (amount = STEP) =>
  applyScale(state.scale - amount)

export const zoomToFit = async () => {
  if (!state.active) return

  const body = document.body
  const widthScale = window.innerWidth * 0.9 / body.scrollWidth
  const heightScale = window.innerHeight * 0.9 / body.scrollHeight

  await applyScale(Math.min(widthScale, heightScale), {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  })
}

export const zoomToHomebase = async () => {
  if (!state.active) return

  await applyScale(1, {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }, true)
  centerCanvas()
}

const isMetaKey = event => event[`${metaKey}Key`] || event.metaKey

const handleKeydown = event => {
  if (!isMetaKey(event)) return

  const action = {
    '=': zoomIn,
    '+': zoomIn,
    '-': zoomOut,
    '0': zoomToHomebase,
    '9': zoomToFit,
  }[event.key]

  if (!action) return
  event.preventDefault()
  action()
}

const handleWheel = event => {
  if (!isMetaKey(event)) return

  event.preventDefault()
  state.mouse = {x: event.clientX, y: event.clientY}
  document.body.style.cursor = event.deltaY < 0 ? 'zoom-in' : 'zoom-out'

  const amount = Math.min(0.5, Math.max(0.02, Math.abs(event.deltaY) * 0.002))
  event.deltaY < 0 ? zoomIn(amount) : zoomOut(amount)
}

const handleMousemove = event => {
  state.mouse = {x: event.clientX, y: event.clientY}
}

const handleKeyup = event => {
  if (!isMetaKey(event)) document.body.style.cursor = state.originalBodyCursor
}

const updateCanvasSize = () => {
  if (!state.active) return

  const html = document.documentElement
  const body = document.body
  const width = Math.max(body.scrollWidth, body.offsetWidth)
  const height = Math.max(body.scrollHeight, body.offsetHeight)

  html.style.setProperty('--visbug-artboard-width', `${width}px`)
  html.style.setProperty('--visbug-artboard-height', `${height}px`)
  html.style.setProperty('--visbug-artboard-canvas-width', `${Math.max(window.innerWidth, width * 2.5)}px`)
  html.style.setProperty('--visbug-artboard-canvas-height', `${Math.max(window.innerHeight, window.innerHeight + height * 1.75)}px`)
}

const centerCanvas = () => window.scrollTo({
  left: (document.documentElement.scrollWidth - window.innerWidth) / 2,
  top: (document.documentElement.scrollHeight - window.innerHeight) / 2,
  behavior: 'auto',
})

const start = selectorEngine => {
  state.selectorEngine = selectorEngine
  if (state.active || !document.body) return

  state.active = true
  state.scale = 1
  state.baseTransform = getComputedStyle(document.body).transform
  state.originalBodyCursor = document.body.style.cursor
  state.originalBodyTransform = document.body.style.transform
  state.originalBodyTransformOrigin = document.body.style.transformOrigin
  state.originalScroll = {left: window.scrollX, top: window.scrollY}
  state.originalStyleSheets = [...document.adoptedStyleSheets]
  document.adoptedStyleSheets = [...state.originalStyleSheets, ArtboardStyles]
  document.documentElement.setAttribute('data-visbug-artboard', '')
  updateCanvasSize()

  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  window.addEventListener('wheel', handleWheel, {passive: false})
  window.addEventListener('mousemove', handleMousemove, {passive: true})
  window.addEventListener('resize', updateCanvasSize)
  state.resizeObserver = new ResizeObserver(updateCanvasSize)
  state.resizeObserver.observe(document.body)

  centerCanvas()
  if (document.readyState !== 'complete') {
    state.pageShowHandler = centerCanvas
    window.addEventListener('pageshow', state.pageShowHandler, {once: true})
  }
}

const stop = () => {
  if (!state.active) return

  state.active = false
  state.generation++
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('mousemove', handleMousemove)
  window.removeEventListener('resize', updateCanvasSize)
  state.resizeObserver && state.resizeObserver.disconnect()
  state.resizeObserver = null
  state.pageShowHandler && window.removeEventListener('pageshow', state.pageShowHandler)
  state.pageShowHandler = null

  document.body.style.transform = state.originalBodyTransform
  document.body.style.transformOrigin = state.originalBodyTransformOrigin
  document.body.style.cursor = state.originalBodyCursor
  document.documentElement.removeAttribute('data-visbug-artboard')
  for (const property of [
    '--visbug-artboard-width',
    '--visbug-artboard-height',
    '--visbug-artboard-canvas-width',
    '--visbug-artboard-canvas-height',
  ]) document.documentElement.style.removeProperty(property)

  document.adoptedStyleSheets = [...document.adoptedStyleSheets]
    .filter(sheet => sheet !== ArtboardStyles)
  window.scrollTo({...state.originalScroll, behavior: 'auto'})

  if (state.selectionStash)
    restoreSelection(state.selectionStash)

  state.originalStyleSheets = null
  state.originalBodyCursor = ''
  state.originalBodyTransform = ''
  state.originalBodyTransformOrigin = ''
  state.originalScroll = {left: 0, top: 0}
  state.selectorEngine = null
  state.scale = 1
  state.selectionStash = null
  state.translate = {x: 0, y: 0}
}

export const Zoom = {start, stop}

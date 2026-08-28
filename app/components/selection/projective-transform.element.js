import { ProjectiveTransformStyles } from '../styles.store'
import { StyleChange } from '../../features/history'
import { getBoxQuad, quadPath } from './quad'
import {
  parseProjectiveTransform,
  pointsApproximatelyEqual,
  projectiveMatrixValues,
  serializeMatrix3d,
} from './projective-transform'

const HANDLE_RADIUS = 7
const CROSS_RADIUS = 3.5

const quadPoints = quad => [quad.p1, quad.p2, quad.p3, quad.p4]

const finitePoint = point =>
  Number.isFinite(point?.x) && Number.isFinite(point?.y)

export class ProjectiveTransform extends HTMLElement {
  constructor() {
    super()
    this.$shadow = this.attachShadow({mode: 'closed'})
    this.styles = [ProjectiveTransformStyles]
    this.position_frame = null
    this.pointer_id = undefined
    this.on_pointer_down = this.on_pointer_down.bind(this)
    this.on_pointer_move = this.on_pointer_move.bind(this)
    this.on_pointer_up = this.on_pointer_up.bind(this)
    this.on_position_change = this.on_position_change.bind(this)
    this.on_document_click = this.on_document_click.bind(this)
    this.on_history_change = this.on_history_change.bind(this)
    this.on_tool_change = this.on_tool_change.bind(this)
    this.on_transition_run = this.on_transition_run.bind(this)
    this.on_transition_end = this.on_transition_end.bind(this)
    this.refresh_transition = this.refresh_transition.bind(this)
  }

  connectedCallback() {
    this.$shadow.adoptedStyleSheets = this.styles
    this.$shadow.innerHTML = this.render()
    this.svg = this.$shadow.querySelector('svg')
    this.path = this.$shadow.querySelector('.outline')
    this.svg.addEventListener('pointerdown', this.on_pointer_down)
    window.addEventListener('resize', this.on_position_change)
    window.addEventListener('scroll', this.on_position_change, true)
    this.outside_click_timer = setTimeout(() => {
      if (this.isConnected)
        document.addEventListener('click', this.on_document_click, true)
    })
    document.addEventListener('visbug-tool-change', this.on_tool_change)

    this.source_observer = new MutationObserver(this.on_position_change)
    this.observe_source()
    this.stop_history_refresh = document.querySelector('vis-bug')?.history
      ?.subscribe(this.on_history_change)

    this.setAttribute('popover', 'manual')
    this.showPopover && this.showPopover()
    this.update_position()
  }

  disconnectedCallback() {
    this.hidePopover && this.hidePopover()
    this.svg?.removeEventListener('pointerdown', this.on_pointer_down)
    window.removeEventListener('resize', this.on_position_change)
    window.removeEventListener('scroll', this.on_position_change, true)
    clearTimeout(this.outside_click_timer)
    document.removeEventListener('click', this.on_document_click, true)
    document.removeEventListener('visbug-tool-change', this.on_tool_change)
    this.source_observer?.disconnect()
    this.source_el?.removeEventListener('transitionrun', this.on_transition_run)
    this.source_el?.removeEventListener('transitionend', this.on_transition_end)
    this.source_el?.removeEventListener('transitioncancel', this.on_transition_end)
    this.stop_history_refresh?.()
    this.position_frame && cancelAnimationFrame(this.position_frame)
    this.history_frame && cancelAnimationFrame(this.history_frame)
    this.transition_frame && cancelAnimationFrame(this.transition_frame)
    this.restore_suppressed_overlays()
    this.stop_drag()
  }

  set source(element) {
    this.source_observer?.disconnect()
    this.source_el?.removeEventListener('transitionrun', this.on_transition_run)
    this.source_el?.removeEventListener('transitionend', this.on_transition_end)
    this.source_el?.removeEventListener('transitioncancel', this.on_transition_end)
    this.source_el = element

    if (this.isConnected && element) {
      this.observe_source()
      this.update_position()
    }
  }

  get source() {
    return this.source_el
  }

  suppress_overlays(overlays) {
    this.restore_suppressed_overlays()
    this.suppressed_overlays = overlays.map(element => ({
      element,
      display: element.style.getPropertyValue('display'),
      priority: element.style.getPropertyPriority('display'),
    }))
    this.suppressed_overlays.forEach(({element}) => {
      element.setAttribute('data-projective-suppressed', '')
      element.style.setProperty('display', 'none', 'important')
    })
  }

  restore_suppressed_overlays() {
    this.suppressed_overlays?.forEach(({element, display, priority}) => {
      if (!element.isConnected) return

      element.removeAttribute('data-projective-suppressed')
      display
        ? element.style.setProperty('display', display, priority)
        : element.style.removeProperty('display')
    })
    this.suppressed_overlays = null
  }

  observe_source() {
    if (!this.source_el) return

    this.source_observer.observe(this.source_el, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-selected'],
    })
    this.source_el.addEventListener('transitionrun', this.on_transition_run)
    this.source_el.addEventListener('transitionend', this.on_transition_end)
    this.source_el.addEventListener('transitioncancel', this.on_transition_end)
  }

  on_position_change() {
    if (!this.source_el?.isConnected || !this.source_el.hasAttribute('data-selected')) {
      this.remove()
      return
    }
    if (this.position_frame || this.pointer_id !== undefined) return

    this.position_frame = requestAnimationFrame(() => {
      this.position_frame = null
      this.update_position()
    })
  }

  on_document_click(event) {
    if (!event.composedPath().includes(this)) this.remove()
  }

  on_tool_change() {
    this.remove()
  }

  on_history_change() {
    if (!this.isConnected) return

    this.update_position()
    this.history_refreshes = 2
    if (!this.history_frame)
      this.history_frame = requestAnimationFrame(() => this.refresh_history())
  }

  refresh_history() {
    this.history_frame = null
    this.update_position()
    if (this.history_refreshes-- > 0)
      this.history_frame = requestAnimationFrame(() => this.refresh_history())
  }

  on_transition_run(event) {
    if (event.target !== this.source_el || event.propertyName !== 'transform') return
    if (!this.transition_frame)
      this.transition_frame = requestAnimationFrame(this.refresh_transition)
  }

  on_transition_end(event) {
    if (event.target !== this.source_el || event.propertyName !== 'transform') return
    if (this.transition_frame) cancelAnimationFrame(this.transition_frame)
    this.transition_frame = null
    this.update_position()
  }

  refresh_transition() {
    this.transition_frame = null
    if (!this.isConnected || this.pointer_id !== undefined) return

    this.update_position()
    this.transition_frame = requestAnimationFrame(this.refresh_transition)
  }

  update_position() {
    if (!this.path || !this.source_el?.isConnected) return

    const points = quadPoints(getBoxQuad(this.source_el))
    if (points.some(point => !finitePoint(point))) {
      this.remove()
      return
    }

    this.path.setAttribute('d', quadPath({
      p1: points[0], p2: points[1], p3: points[2], p4: points[3],
    }))

    points.forEach((point, index) => {
      const group = this.$shadow.querySelector(`[data-corner="${index}"]`)
      group.setAttribute('transform', `translate(${point.x} ${point.y})`)
    })
  }

  on_pointer_down(event) {
    const handle = event.target.closest('.handle')
    if (!handle || event.button !== 0 || !this.start_drag()) return

    event.preventDefault()
    event.stopPropagation()
    this.active_corner = Number(handle.dataset.corner)
    this.pointer_id = event.pointerId
    this.drag_handle = handle
    this.original_cursor = document.body.style.cursor
    this.original_user_select = document.body.style.userSelect
    document.body.style.cursor = 'move'
    document.body.style.userSelect = 'none'
    handle.setPointerCapture(event.pointerId)
    handle.addEventListener('pointermove', this.on_pointer_move)
    handle.addEventListener('pointerup', this.on_pointer_up)
    handle.addEventListener('pointercancel', this.on_pointer_up)
  }

  start_drag() {
    if (!this.source_el?.isConnected) return false

    this.original_transform = this.source_el.style.transform
    this.original_priority = this.source_el.style.getPropertyPriority('transform')
    this.original_transition = this.source_el.style.transition
    const persistedTransform = this.original_transform
      || getComputedStyle(this.source_el).transform
    const parsed = parseProjectiveTransform(persistedTransform)
    this.base_transform = parsed.baseTransform
    this.projective_transform = parsed.projectiveTransform
    const currentQuad = getBoxQuad(this.source_el)

    this.source_el.style.transition = 'none'
    this.source_el.style.transform = this.build_transform(this.base_transform, '')
    this.target_points = quadPoints(currentQuad)
      .map(point => this.viewport_to_local(point))
    this.source_el.style.transform = this.build_transform(
      this.base_transform,
      this.projective_transform,
    )

    if (this.target_points.length !== 4
      || this.target_points.some(point => !finitePoint(point))) {
      this.source_el.style.transform = this.original_transform
      this.source_el.style.transition = this.original_transition
      return false
    }

    return true
  }

  on_pointer_move(event) {
    if (event.pointerId !== this.pointer_id) return

    event.preventDefault()
    event.stopPropagation()
    const point = this.local_pointer_point(event)
    if (!point) return

    this.target_points[this.active_corner] = point
    this.apply_preview()
  }

  on_pointer_up(event) {
    if (event.pointerId !== this.pointer_id) return

    event.preventDefault()
    event.stopPropagation()
    const point = this.local_pointer_point(event)
    if (point) {
      this.target_points[this.active_corner] = point
      this.apply_preview()
    }

    const newTransform = this.source_el.style.transform
    this.stop_drag()

    if (this.original_transform !== newTransform) {
      document.querySelector('vis-bug')?.history?.push(new StyleChange({
        element: this.source_el,
        property: 'transform',
        oldValue: this.original_transform,
        newValue: newTransform,
        oldPriority: this.original_priority,
        newPriority: this.source_el.style.getPropertyPriority('transform'),
      }))
    }

    this.update_position()
  }

  stop_drag() {
    if (this.drag_handle) {
      this.drag_handle.removeEventListener('pointermove', this.on_pointer_move)
      this.drag_handle.removeEventListener('pointerup', this.on_pointer_up)
      this.drag_handle.removeEventListener('pointercancel', this.on_pointer_up)
    }
    if (this.original_transition !== undefined && this.source_el)
      this.source_el.style.transition = this.original_transition
    if (this.original_cursor !== undefined)
      document.body.style.cursor = this.original_cursor
    if (this.original_user_select !== undefined)
      document.body.style.userSelect = this.original_user_select

    this.pointer_id = undefined
    this.active_corner = undefined
    this.drag_handle = null
    this.original_transition = undefined
    this.original_cursor = undefined
    this.original_user_select = undefined
  }

  local_pointer_point(event) {
    const previewTransform = this.source_el.style.transform
    this.source_el.style.transform = this.build_transform(this.base_transform, '')
    const point = this.viewport_to_local({x: event.clientX, y: event.clientY})
    this.source_el.style.transform = previewTransform
    return finitePoint(point) ? {x: point.x, y: point.y} : null
  }

  viewport_to_local(point) {
    return this.source_el.convertPointFromNode({
      x: point.x + window.scrollX,
      y: point.y + window.scrollY,
    }, document.documentElement)
  }

  apply_preview() {
    const projectiveTransform = this.build_projective_transform(this.target_points)
    if (projectiveTransform == null) return

    this.projective_transform = projectiveTransform
    this.source_el.style.transform = this.build_transform(
      this.base_transform,
      projectiveTransform,
    )
    this.update_position()
  }

  build_projective_transform(points) {
    const {width, height} = this.element_size()
    const sourcePoints = [
      {x: 0, y: 0},
      {x: width, y: 0},
      {x: width, y: height},
      {x: 0, y: height},
    ]

    if (!width || !height || points.length !== 4) return ''
    if (pointsApproximatelyEqual(points, sourcePoints)) return ''

    const values = projectiveMatrixValues(points, width, height)
    if (!values) return null

    const matrix = new DOMMatrix(values)
    const [originX, originY] = getComputedStyle(this.source_el)
      .transformOrigin.split(' ')
      .map(value => parseFloat(value) || 0)
    const corrected = new DOMMatrix()
      .translate(-originX, -originY)
      .multiply(matrix)
      .multiply(new DOMMatrix().translate(originX, originY))

    return serializeMatrix3d(corrected)
  }

  element_size() {
    const style = getComputedStyle(this.source_el)
    return {
      width: this.source_el.offsetWidth
        || parseFloat(style.width)
        || this.source_el.getBBox?.().width
        || 0,
      height: this.source_el.offsetHeight
        || parseFloat(style.height)
        || this.source_el.getBBox?.().height
        || 0,
    }
  }

  build_transform(baseTransform, projectiveTransform) {
    return [baseTransform, projectiveTransform]
      .map(transform => transform?.trim())
      .filter(Boolean)
      .join(' ')
  }

  render() {
    return `
      <svg aria-label="3D transform handles">
        <path class="outline"></path>
        ${[0, 1, 2, 3].map(index => `
          <g data-corner="${index}">
            <circle
              class="handle"
              data-corner="${index}"
              r="${HANDLE_RADIUS}"
              role="button"
              aria-label="Move corner ${index + 1}"
            ></circle>
            <line class="cross" x1="-${CROSS_RADIUS}" x2="${CROSS_RADIUS}"></line>
            <line class="cross" y1="-${CROSS_RADIUS}" y2="${CROSS_RADIUS}"></line>
          </g>`).join('')}
      </svg>
    `
  }
}

customElements.define('visbug-projective-transform', ProjectiveTransform)

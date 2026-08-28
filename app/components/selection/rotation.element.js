import { RotationStyles } from '../styles.store'
import { getBoxQuad, pointOutsideQuad, quadCenter } from './quad'
import { normalizeAngleDelta } from './rotation'
import { BatchChange, StyleChange } from '../../features/history'

const HANDLE_DISTANCE = 30

export class Rotation extends HTMLElement {
  constructor() {
    super()
    this.$shadow = this.attachShadow({mode: 'closed'})
    this.styles = [RotationStyles]
    this.position_frame = null
    this.source_el = null
    this.initial_quad = null
    this.on_pointer_down = this.on_pointer_down.bind(this)
    this.on_pointer_move = this.on_pointer_move.bind(this)
    this.on_pointer_up = this.on_pointer_up.bind(this)
    this.on_position_change = this.on_position_change.bind(this)
  }

  connectedCallback() {
    this.$shadow.adoptedStyleSheets = this.styles
    this.$shadow.innerHTML = this.render()
    this.handle = this.$shadow.querySelector('.rotation-handle')
    this.line_svg = this.$shadow.querySelector('.rotation-line')
    this.line = this.$shadow.querySelector('.rotation-line line')
    this.handle.addEventListener('pointerdown', this.on_pointer_down)
    window.addEventListener('resize', this.on_position_change)
    window.addEventListener('scroll', this.on_position_change, true)
    this.update_position(this.initial_quad)
    this.initial_quad = null
  }

  disconnectedCallback() {
    this.handle && this.handle.removeEventListener('pointerdown', this.on_pointer_down)
    this.handle && this.handle.removeEventListener('pointermove', this.on_pointer_move)
    this.handle && this.handle.removeEventListener('pointerup', this.on_pointer_up)
    this.handle && this.handle.removeEventListener('pointercancel', this.on_pointer_up)
    window.removeEventListener('resize', this.on_position_change)
    window.removeEventListener('scroll', this.on_position_change, true)
    this.position_frame && window.cancelAnimationFrame(this.position_frame)
    this.restore_transition()
  }

  set position({el, node_label_id, quad = null}) {
    this.source_el = el
    this.initial_quad = quad
    this.setAttribute('data-label-id', node_label_id)
    if (this.pointer_id === undefined && this.handle) {
      this.update_position(quad)
      this.initial_quad = null
    }
  }

  on_position_change() {
    if (this.position_frame || !this.source_el || this.pointer_id !== undefined) return

    this.position_frame = window.requestAnimationFrame(() => {
      this.position_frame = null
      this.update_position()
    })
  }

  update_position(quad = null) {
    if (!this.handle || !this.source_el?.isConnected) return

    quad ||= getBoxQuad(this.source_el)
    const center = quadCenter(quad)
    const handle = pointOutsideQuad(quad, 'top', HANDLE_DISTANCE)

    this.handle.style.left = `${handle.x}px`
    this.handle.style.top = `${handle.y}px`
    this.set_line(center, handle)
  }

  on_pointer_down(event) {
    event.preventDefault()
    event.stopPropagation()

    this.original_display = this.source_el.style.display
    this.original_transform = this.source_el.style.transform
    if (getComputedStyle(this.source_el).display === 'inline')
      this.source_el.style.display = 'inline-block'

    const quad = getBoxQuad(this.source_el)
    this.center = quadCenter(quad)
    this.last_angle = Math.atan2(
      event.clientY - this.center.y,
      event.clientX - this.center.x,
    )
    this.rotation = 0
    const transform = this.source_el.style.transform
      || getComputedStyle(this.source_el).transform
    this.base_transform = transform === 'none' ? '' : transform
    this.pointer_id = event.pointerId
    this.original_transition = this.source_el.style.transition
    this.source_el.style.transition = 'none'
    this.line_svg.classList.add('active')
    this.handle.setPointerCapture(event.pointerId)
    this.handle.addEventListener('pointermove', this.on_pointer_move)
    this.handle.addEventListener('pointerup', this.on_pointer_up)
    this.handle.addEventListener('pointercancel', this.on_pointer_up)
  }

  on_pointer_move(event) {
    if (event.pointerId !== this.pointer_id) return

    const angle = Math.atan2(
      event.clientY - this.center.y,
      event.clientX - this.center.x,
    )
    this.rotation += normalizeAngleDelta(angle - this.last_angle)
    this.last_angle = angle

    const degrees = this.rotation * (180 / Math.PI)
    const rotate = `rotate(${degrees}deg)`
    this.source_el.style.transform = `${this.base_transform} ${rotate}`.trim()
    this.on_geometry_change && this.on_geometry_change()

    const handle = {x: event.clientX, y: event.clientY}
    this.handle.style.left = `${handle.x}px`
    this.handle.style.top = `${handle.y}px`
    this.set_line(this.center, handle)
  }

  on_pointer_up(event) {
    if (event.pointerId !== this.pointer_id) return

    this.handle.removeEventListener('pointermove', this.on_pointer_move)
    this.handle.removeEventListener('pointerup', this.on_pointer_up)
    this.handle.removeEventListener('pointercancel', this.on_pointer_up)
    this.pointer_id = undefined
    this.line_svg.classList.remove('active')
    this.update_position()
    this.restore_transition()
    const changes = [
      new StyleChange({element: this.source_el, property: 'display',
        oldValue: this.original_display, newValue: this.source_el.style.display}),
      new StyleChange({element: this.source_el, property: 'transform',
        oldValue: this.original_transform, newValue: this.source_el.style.transform}),
    ].filter(change => change.oldValue !== change.newValue)
    document.querySelector('vis-bug')?.history?.push(new BatchChange(changes))
  }

  restore_transition() {
    if (this.original_transition === undefined) return

    if (this.source_el)
      this.source_el.style.transition = this.original_transition

    this.original_transition = undefined
  }

  set_line(start, end) {
    this.line.setAttribute('x1', start.x)
    this.line.setAttribute('y1', start.y)
    this.line.setAttribute('x2', end.x)
    this.line.setAttribute('y2', end.y)
  }

  render() {
    return `
      <svg class="rotation-line" aria-hidden="true">
        <line></line>
      </svg>
      <button class="rotation-handle" type="button" aria-label="Rotate element">
        <svg class="rotation-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"></path>
        </svg>
      </button>
    `
  }
}

customElements.define('visbug-rotation', Rotation)

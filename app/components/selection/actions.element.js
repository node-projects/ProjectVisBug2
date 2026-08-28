import { ActionsStyles } from '../styles.store'
import { getSelectionActions } from '../../plugins/_registry'

let nextMenuId = 0

export class SelectionActions extends HTMLElement {

  constructor() {
    super()
    this.$shadow = this.attachShadow({mode: 'closed'})
    this.source_el = null
    this.menu_id = `visbug-selection-menu-${nextMenuId++}`
    this.on_registry_change = this.render.bind(this)
    this.on_keydown = this.on_keydown.bind(this)
    this.on_pointerdown = this.on_pointerdown.bind(this)
    this.on_click = this.on_click.bind(this)
  }

  connectedCallback() {
    this.$shadow.adoptedStyleSheets = [ActionsStyles]
    document.addEventListener('visbug-selection-actions-change', this.on_registry_change)
    this.addEventListener('keydown', this.on_keydown)
    this.$shadow.addEventListener('pointerdown', this.on_pointerdown)
    this.$shadow.addEventListener('click', this.on_click)
    this.render()
  }

  disconnectedCallback() {
    document.removeEventListener('visbug-selection-actions-change', this.on_registry_change)
    this.removeEventListener('keydown', this.on_keydown)
    this.$shadow.removeEventListener('pointerdown', this.on_pointerdown)
    this.$shadow.removeEventListener('click', this.on_click)
  }

  set source(element) {
    this.source_el = element
  }

  get open() {
    return Boolean(this.$shadow.querySelector(':popover-open'))
  }

  on_keydown(event) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    this.close()
    this.$shadow.querySelector('.trigger')?.focus()
  }

  on_pointerdown(event) {
    const button = event.target.closest('[data-command]')
    if (!button) return

    event.preventDefault()
    event.stopPropagation()
    if (this.hasAttribute('busy')) return
    this.runAction(button, event)
  }

  on_click(event) {
    const button = event.target.closest('[data-command]')
    if (!button) return

    event.preventDefault()
    event.stopPropagation()

    // Pointer activation already ran on pointerdown, before a nested popover
    // can be light-dismissed. A zero-detail click is keyboard/programmatic.
    if (event.detail) return
    if (this.hasAttribute('busy')) return
    this.runAction(button, event)
  }

  async runAction(button, activationEvent) {
    const label = button.textContent
    button.ariaDisabled = 'true'
    button.textContent = `${label}…`
    this.setAttribute('busy', '')

    try {
      const visbug = document.querySelector('vis-bug')
      if (!visbug) throw new Error('VisBug is not connected')
      await visbug.execCommand(button.dataset.command, {
        source: this.source_el,
        activationEvent,
      })
      this.close()
    }
    catch (error) {
      console.error('VisBug selection action failed', error)
      this.dispatchEvent(new CustomEvent('visbug-selection-action-error', {
        bubbles: true,
        detail: {command: button.dataset.command, error},
      }))
    }
    finally {
      button.textContent = label
      button.removeAttribute('aria-disabled')
      this.removeAttribute('busy')
    }
  }

  close() {
    Array.from(this.$shadow.querySelectorAll('[popover]'))
      .reverse()
      .forEach(popover => {
        if (popover.matches(':popover-open')) popover.hidePopover()
      })
  }

  createAction(action) {
    if (!action.command) return null

    const button = document.createElement('button')
    button.type = 'button'
    button.role = 'menuitem'
    button.dataset.command = action.command
    button.textContent = action.label
    return button
  }

  showSubmenu(popover, source) {
    if (!popover.showPopover || popover.matches(':popover-open')) return

    try {
      popover.showPopover({source})
    }
    catch {
      popover.showPopover()
    }
  }

  createGroup(action) {
    const children = action.children
      .map(child => this.createAction(child))
      .filter(Boolean)

    if (!children.length) return this.createAction(action)

    const fragment = document.createDocumentFragment()
    const button = document.createElement('button')
    const submenu = document.createElement('div')
    const submenuId = `${this.menu_id}-${action.id}`

    button.type = 'button'
    button.className = 'group'
    button.role = 'menuitem'
    button.textContent = action.label

    const arrow = document.createElement('span')
    arrow.ariaHidden = 'true'
    arrow.innerHTML = `
      <svg viewBox="0 0 12 16">
        <path d="M3 2.5 8.5 8 3 13.5"></path>
      </svg>`
    button.appendChild(arrow)

    submenu.id = submenuId
    submenu.className = 'submenu-items'
    submenu.popover = 'auto'
    submenu.role = 'menu'
    submenu.ariaLabel = action.label
    submenu.append(...children)
    button.popoverTargetElement = submenu

    button.addEventListener('pointerenter', () =>
      this.showSubmenu(submenu, button))
    button.addEventListener('focus', () =>
      this.showSubmenu(submenu, button))

    fragment.append(button, submenu)
    return fragment
  }

  render() {
    const items = getSelectionActions()
      .map(action => this.createGroup(action))
      .filter(Boolean)

    this.$shadow.replaceChildren()
    this.hidden = !items.length
    if (!items.length) return

    const menu = document.createElement('div')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'trigger'
    button.ariaLabel = 'Selected element actions'
    button.title = 'Selected element actions'
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 18 18">
        <circle cx="4" cy="9" r="1.5"></circle>
        <circle cx="9" cy="9" r="1.5"></circle>
        <circle cx="14" cy="9" r="1.5"></circle>
      </svg>`

    menu.id = this.menu_id
    menu.className = 'menu'
    menu.popover = 'auto'
    menu.role = 'menu'
    menu.ariaLabel = 'Selected element actions'
    menu.append(...items)
    button.popoverTargetElement = menu

    this.$shadow.append(button, menu)
  }
}

customElements.define('visbug-selection-actions', SelectionActions)

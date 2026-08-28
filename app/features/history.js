const defaultMergeWindow = 750

export class Change {
  constructor({timestamp = Date.now(), mergeKey = null} = {}) {
    this.timestamp = timestamp
    this.mergeKey = mergeKey
  }

  undo() { throw new Error('undo() must be implemented') }
  redo() { throw new Error('redo() must be implemented') }
  canMerge() { return false }
  merge() { return this }
}

const writeStyle = (element, property, value, priority = '') => {
  if (!element) return

  if (property.startsWith('--') || property.includes('-')) {
    value === ''
      ? element.style.removeProperty(property)
      : element.style.setProperty(property, value, priority)
  }
  else {
    element.style[property] = value
  }
}

export class StyleChange extends Change {
  constructor({element, property, oldValue, newValue, oldPriority = '', newPriority = '', ...options}) {
    super(options)
    this.element = element
    this.property = property
    this.oldValue = oldValue
    this.newValue = newValue
    this.oldPriority = oldPriority
    this.newPriority = newPriority
  }

  undo() { writeStyle(this.element, this.property, this.oldValue, this.oldPriority) }
  redo() { writeStyle(this.element, this.property, this.newValue, this.newPriority) }

  canMerge(other, mergeWindow = defaultMergeWindow) {
    return other instanceof StyleChange
      && other.element === this.element
      && other.property === this.property
      && other.mergeKey === this.mergeKey
      && other.timestamp - this.timestamp <= mergeWindow
  }

  merge(other) {
    return new StyleChange({
      element: this.element,
      property: this.property,
      oldValue: this.oldValue,
      newValue: other.newValue,
      oldPriority: this.oldPriority,
      newPriority: other.newPriority,
      timestamp: other.timestamp,
      mergeKey: this.mergeKey,
    })
  }
}

export class AttributeChange extends Change {
  constructor({element, attribute, oldValue, newValue, ...options}) {
    super(options)
    this.element = element
    this.attribute = attribute
    this.oldValue = oldValue
    this.newValue = newValue
  }

  set(value) {
    if (!this.element) return
    value === null
      ? this.element.removeAttribute(this.attribute)
      : this.element.setAttribute(this.attribute, value)
  }

  undo() { this.set(this.oldValue) }
  redo() { this.set(this.newValue) }
}

const restorePosition = (element, position) => {
  if (!element || !position?.parent) return element?.remove()

  const {parent, nextSibling, index} = position
  const anchor = nextSibling?.parentNode === parent
    ? nextSibling
    : parent.childNodes[index] || null

  parent.insertBefore(element, anchor)
}

export const domPosition = element => ({
  parent: element?.parentNode || null,
  nextSibling: element?.nextSibling || null,
  index: element?.parentNode
    ? Array.prototype.indexOf.call(element.parentNode.childNodes, element)
    : -1,
})

export class DOMChange extends Change {
  constructor({element, oldPosition, newPosition, oldParent, oldNextSibling,
    newParent, newNextSibling, ...options}) {
    super(options)
    this.element = element
    this.oldPosition = oldPosition || {
      parent: oldParent || null,
      nextSibling: oldNextSibling || null,
      index: -1,
    }
    this.newPosition = newPosition || {
      parent: newParent || null,
      nextSibling: newNextSibling || null,
      index: -1,
    }
  }

  undo() { restorePosition(this.element, this.oldPosition) }
  redo() { restorePosition(this.element, this.newPosition) }
}

export class TextChange extends Change {
  constructor({element, oldText, newText, ...options}) {
    super(options)
    this.element = element
    this.oldText = oldText
    this.newText = newText
  }

  undo() { if (this.element) this.element.innerHTML = this.oldText }
  redo() { if (this.element) this.element.innerHTML = this.newText }
}

export class BatchChange extends Change {
  constructor(changes, options = {}) {
    super(options)
    this.changes = changes.filter(Boolean)
  }

  undo() { [...this.changes].reverse().forEach(change => change.undo()) }
  redo() { this.changes.forEach(change => change.redo()) }

  canMerge(other, mergeWindow = defaultMergeWindow) {
    return other instanceof BatchChange
      && this.mergeKey !== null
      && this.mergeKey === other.mergeKey
      && this.changes.length === other.changes.length
      && other.timestamp - this.timestamp <= mergeWindow
      && this.changes.every((change, index) =>
        change.canMerge(other.changes[index], mergeWindow))
  }

  merge(other) {
    return new BatchChange(
      this.changes.map((change, index) => change.merge(other.changes[index])),
      {timestamp: other.timestamp, mergeKey: this.mergeKey}
    )
  }
}

export class HistoryManager {
  constructor({maxSize = 50, mergeWindow = defaultMergeWindow} = {}) {
    this.maxSize = maxSize
    this.mergeWindow = mergeWindow
    this.undoStack = []
    this.redoStack = []
    this.listeners = new Set()
  }

  push(change) {
    if (!change || change instanceof BatchChange && !change.changes.length)
      return false

    const previous = this.undoStack.at(-1)
    if (previous?.canMerge(change, this.mergeWindow))
      this.undoStack[this.undoStack.length - 1] = previous.merge(change)
    else {
      this.undoStack.push(change)
      if (this.undoStack.length > this.maxSize) this.undoStack.shift()
    }

    this.redoStack.length = 0
    return true
  }

  undo() {
    const change = this.undoStack.pop()
    if (!change) return false

    try {
      change.undo()
      this.redoStack.push(change)
      this.notify('undo', change)
      return true
    }
    catch (error) {
      this.undoStack.push(change)
      console.error('Could not undo VisBug change', error)
      return false
    }
  }

  redo() {
    const change = this.redoStack.pop()
    if (!change) return false

    try {
      change.redo()
      this.undoStack.push(change)
      this.notify('redo', change)
      return true
    }
    catch (error) {
      this.redoStack.push(change)
      console.error('Could not redo VisBug change', error)
      return false
    }
  }

  clear() {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }

  canUndo() { return this.undoStack.length > 0 }
  canRedo() { return this.redoStack.length > 0 }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(action, change) {
    this.listeners.forEach(listener => listener({action, change}))
  }

  get size() {
    return {undo: this.undoStack.length, redo: this.redoStack.length}
  }
}

const inlineStyle = (element, property) => {
  const cssProperty = property.startsWith('--') || property.includes('-')
    ? property
    : property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

  return {
    value: element.style.getPropertyValue(cssProperty),
    priority: element.style.getPropertyPriority(cssProperty),
  }
}

export const recordStyleChanges = ({history, elements, properties, update, mergeKey = null}) => {
  const targets = Array.from(elements || [])
  const props = Array.from(properties || [])
  const before = targets.map(element =>
    props.map(property => inlineStyle(element, property)))

  update()

  const changes = []
  targets.forEach((element, elementIndex) =>
    props.forEach((property, propertyIndex) => {
      const oldStyle = before[elementIndex][propertyIndex]
      const newStyle = inlineStyle(element, property)
      if (oldStyle.value === newStyle.value && oldStyle.priority === newStyle.priority) return

      changes.push(new StyleChange({
        element,
        property,
        oldValue: oldStyle.value,
        newValue: newStyle.value,
        oldPriority: oldStyle.priority,
        newPriority: newStyle.priority,
        mergeKey,
      }))
    }))

  history?.push(changes.length === 1
    ? changes[0]
    : new BatchChange(changes, {mergeKey}))

  return changes
}

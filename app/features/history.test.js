import test from 'ava'
import {
  HistoryManager, StyleChange, DOMChange, TextChange, BatchChange,
  domPosition, recordStyleChanges
} from './history.js'

const cssName = property => property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

class FakeStyle {
  constructor() {
    this.values = new Map()
    this.priorities = new Map()
    return new Proxy(this, {
      get: (target, property) => property in target
        ? target[property]
        : target.getPropertyValue(cssName(property)),
      set: (target, property, value) => {
        if (property in target) target[property] = value
        else target.setProperty(cssName(property), value || '')
        return true
      },
    })
  }
  getPropertyValue(property) { return this.values.get(property) || '' }
  getPropertyPriority(property) { return this.priorities.get(property) || '' }
  setProperty(property, value, priority = '') {
    this.values.set(property, String(value))
    this.priorities.set(property, priority)
  }
  removeProperty(property) {
    this.values.delete(property)
    this.priorities.delete(property)
  }
}

const fakeElement = () => ({style: new FakeStyle(), innerHTML: ''})

class FakeNode {
  constructor() {
    this.parentNode = null
    this.childNodes = []
  }
  get nextSibling() {
    if (!this.parentNode) return null
    return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null
  }
  get firstChild() { return this.childNodes[0] || null }
  append(...nodes) { nodes.forEach(node => this.insertBefore(node, null)) }
  insertBefore(node, anchor) {
    node.remove()
    const index = anchor ? this.childNodes.indexOf(anchor) : this.childNodes.length
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node)
    node.parentNode = this
  }
  remove() {
    if (!this.parentNode) return
    this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1)
    this.parentNode = null
  }
}

test('style changes undo, redo, and restore absent inline styles', t => {
  const el = fakeElement()
  const history = new HistoryManager()

  recordStyleChanges({
    history,
    elements: [el],
    properties: ['marginTop'],
    update: () => el.style.marginTop = '12px',
  })

  t.is(el.style.marginTop, '12px')
  t.true(history.undo())
  t.is(el.style.marginTop, '')
  t.true(history.redo())
  t.is(el.style.marginTop, '12px')
})

test('new edits clear redo and history is bounded', t => {
  const el = fakeElement()
  const history = new HistoryManager({maxSize: 2, mergeWindow: 0})

  for (const value of ['1px', '2px', '3px']) {
    const oldValue = el.style.left
    el.style.left = value
    history.push(new StyleChange({
      element: el,
      property: 'left',
      oldValue,
      newValue: value,
      mergeKey: value,
    }))
  }

  t.is(history.size.undo, 2)
  history.undo()
  t.true(history.canRedo())
  history.push(new TextChange({element: el, oldText: '', newText: 'new'}))
  t.false(history.canRedo())
})

test('repeated batches merge without losing the original value', t => {
  const el = fakeElement()
  const history = new HistoryManager({mergeWindow: 1000})

  for (const value of ['1px', '2px'])
    recordStyleChanges({
      history,
      elements: [el],
      properties: ['paddingTop'],
      mergeKey: 'padding:up',
      update: () => el.style.paddingTop = value,
    })

  t.is(history.size.undo, 1)
  history.undo()
  t.is(el.style.paddingTop, '')
  history.redo()
  t.is(el.style.paddingTop, '2px')
})

test('DOM changes restore position even when the remembered sibling moved', t => {
  const oldParent = new FakeNode()
  const newParent = new FakeNode()
  const el = new FakeNode()
  const sibling = new FakeNode()
  oldParent.append(el, sibling)
  const oldPosition = domPosition(el)
  newParent.append(el)
  const change = new DOMChange({element: el, oldPosition, newPosition: domPosition(el)})

  sibling.remove()
  change.undo()
  t.is(el.parentNode, oldParent)
  t.is(oldParent.firstChild, el)
  change.redo()
  t.is(el.parentNode, newParent)
})

test('batch undo runs in reverse order', t => {
  const calls = []
  const change = name => ({undo: () => calls.push(`undo ${name}`), redo: () => calls.push(`redo ${name}`)})
  const batch = new BatchChange([change('a'), change('b')])

  batch.undo()
  batch.redo()
  t.deepEqual(calls, ['undo b', 'undo a', 'redo a', 'redo b'])
})

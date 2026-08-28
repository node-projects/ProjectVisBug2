import $ from 'blingblingjs'
import hotkeys from 'hotkeys-js'
import { showHideNodeLabel } from '../utilities/'
import { TextChange } from './history'

const removeEditability = ({target}) => {
  const oldText = target.__visbugOriginalText
  if (oldText !== undefined && oldText !== target.innerHTML)
    target.__visbugHistory?.push(new TextChange({
      element: target,
      oldText,
      newText: target.innerHTML,
    }))

  delete target.__visbugOriginalText
  delete target.__visbugHistory
  target.removeAttribute('contenteditable')
  target.removeAttribute('spellcheck')
  target.removeEventListener('blur', removeEditability)
  target.removeEventListener('keydown', stopBubbling)
  hotkeys.unbind('escape,esc')
}

const stopBubbling = e => e.key != 'Escape' && e.stopPropagation()

const cleanup = (e, handler) => {
  $('[spellcheck="true"]').forEach(target => removeEditability({target}))
  window.getSelection().empty()
}

export function EditText(elements, history) {
  if (!elements.length) return

  elements.map(el => {
    let $el = $(el)

    $el.attr({
      contenteditable: true,
      spellcheck: true,
    })
    if (el.__visbugOriginalText === undefined)
      el.__visbugOriginalText = el.innerHTML
    el.__visbugHistory = history
    el.focus()
    showHideNodeLabel(el, true)

    $el.on('keydown', stopBubbling)
    $el.on('blur', removeEditability)
  })

  hotkeys('escape,esc', cleanup)
}

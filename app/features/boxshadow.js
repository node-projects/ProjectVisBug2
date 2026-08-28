import hotkeys from 'hotkeys-js'
import { metaKey, getStyle, showHideSelected } from '../utilities/'
import { recordStyleChanges } from './history'

const key_events = 'up,down,left,right'
  .split(',')
  .reduce((events, event) =>
    `${events},${event},shift+${event},alt+${event},alt+shift+${event}`
  , '')
  .substring(1)

const command_events = `${metaKey}+up,${metaKey}+shift+up,${metaKey}+down,${metaKey}+shift+down,${metaKey}+left,${metaKey}+shift+left,${metaKey}+right,${metaKey}+shift+right`

export function BoxShadow({selection}, history) {
  hotkeys(key_events, (e, handler) => {
    if (e.cancelBubble) return

    e.preventDefault()

    let selectedNodes = selection()
      , keys = handler.key.split('+')

    const prop = keys.includes('left') || keys.includes('right')
      ? keys.includes('alt') ? 'size' : 'x'
      : keys.includes('alt') ? 'blur' : 'y'
    recordStyleChanges({history, elements: selectedNodes, properties: ['boxShadow'],
      mergeKey: `shadow:${handler.key}:${prop}`,
      update: () => changeBoxShadow(selectedNodes, keys, prop)})
  })

  hotkeys(command_events, (e, handler) => {
    e.preventDefault()
    let keys = handler.key.split('+')
    const elements = selection()
    const prop = keys.includes('left') || keys.includes('right') ? 'opacity' : 'inset'
    recordStyleChanges({history, elements, properties: ['boxShadow'],
      mergeKey: `shadow:${handler.key}:${prop}`,
      update: () => changeBoxShadow(elements, keys, prop)})
  })

  return () => {
    hotkeys.unbind(key_events)
    hotkeys.unbind(command_events)
    hotkeys.unbind('up,down,left,right')
  }
}

const ensureHasShadow = el => {
  if (el.style.boxShadow == '' || el.style.boxShadow == 'none')
    el.style.boxShadow = 'hsla(0,0%,0%,30%) 0 0 0 0'
  return el
}

// todo: work around this propMap with a better split
const propMap = {
  'opacity':  3,
  'x':        4,
  'y':        5,
  'blur':     6,
  'size':     7,
  'inset':    8,
}

const parseCurrentShadow = el => getStyle(el, 'boxShadow').split(' ')

export function changeBoxShadow(els, direction, prop) {
  els
    .map(ensureHasShadow)
    .map(el => showHideSelected(el, 1500))
    .map(el => ({
      el,
      style:     'boxShadow',
      current:   parseCurrentShadow(el), // ["rgb(255,", "0,", "0)", "0px", "0px", "1px", "0px"]
      propIndex: parseCurrentShadow(el)[0].includes('rgba') ? propMap[prop] : propMap[prop] - 1
    }))
    .map(payload => {
      let updated = [...payload.current]
      let cur     = prop === 'opacity'
        ? payload.current[payload.propIndex]
        : parseInt(payload.current[payload.propIndex])

      switch(prop) {
        case 'blur': 
        case 'size':
          var amount = direction.includes('shift') ? 10 : 1
          updated[payload.propIndex] = direction.includes('down') || direction.includes('left')
            ? `${cur - amount}px`
            : `${cur + amount}px`
          break
        case 'inset':
          updated[payload.propIndex] = direction.includes('down')
            ? 'inset'
            : ''
          break
        case 'opacity':
          let cur_opacity = parseFloat(cur.slice(0, cur.indexOf(')')))
          var amount = direction.includes('shift') ? 0.10 : 0.01
          updated[payload.propIndex] = direction.includes('left')
            ? cur_opacity - amount + ')'
            : cur_opacity + amount + ')'
          break
        default:
          var amount = direction.includes('shift') ? 10 : 1
          updated[payload.propIndex] = direction.includes('left') || direction.includes('up')
            ? `${cur - amount}px`
            : `${cur + amount}px`
          break
      }

      payload.value = updated
      return payload
    })
    .forEach(({el, style, value}) =>
      el.style[style] = value.join(' '))
}

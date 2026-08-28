import hotkeys from 'hotkeys-js'
import { metaKey, getStyle, showHideSelected } from '../utilities/'
import { recordStyleChanges } from './history'

const key_events = 'up,down,left,right'
  .split(',')
  .reduce((events, event) =>
    `${events},${event},shift+${event}`
  , '')
  .substring(1)

const command_events = `${metaKey}+up,${metaKey}+down`

export function Font({selection}, history) {
  hotkeys(key_events, (e, handler) => {
    if (e.cancelBubble) return

    e.preventDefault()

    let selectedNodes = selection()
      , keys = handler.key.split('+')

    const property = keys.includes('left') || keys.includes('right')
      ? keys.includes('shift') ? 'letterSpacing' : 'textAlign'
      : keys.includes('shift') ? 'lineHeight' : 'fontSize'
    recordStyleChanges({history, elements: selectedNodes, properties: [property],
      mergeKey: `font:${handler.key}`, update: () => {
        if (property === 'letterSpacing') changeKerning(selectedNodes, handler.key)
        else if (property === 'textAlign') changeAlignment(selectedNodes, handler.key)
        else if (property === 'lineHeight') changeLeading(selectedNodes, handler.key)
        else changeFontSize(selectedNodes, handler.key)
      }})
  })

  hotkeys(command_events, (e, handler) => {
    e.preventDefault()
    let keys = handler.key.split('+')
    const elements = selection()
    recordStyleChanges({history, elements, properties: ['fontWeight'],
      mergeKey: `font:weight:${handler.key}`,
      update: () => changeFontWeight(elements, keys.includes('up') ? 'up' : 'down')})
  })

  hotkeys('cmd+b', e => {
    const elements = selection()
    recordStyleChanges({history, elements, properties: ['fontWeight'], update: () =>
      elements.forEach(el => el.style.fontWeight = el.style.fontWeight == 'bold' ? null : 'bold')})
  })

  hotkeys('cmd+i', e => {
    const elements = selection()
    recordStyleChanges({history, elements, properties: ['fontStyle'], update: () =>
      elements.forEach(el => el.style.fontStyle = el.style.fontStyle == 'italic' ? null : 'italic')})
  })

  return () => {
    hotkeys.unbind(key_events)
    hotkeys.unbind(command_events)
    hotkeys.unbind('cmd+b,cmd+i')
    hotkeys.unbind('up,down,left,right')
  }
}

export function changeLeading(els, direction) {
  els
    .map(el => showHideSelected(el))
    .map(el => ({
      el,
      style:    'lineHeight',
      current:  parseInt(getStyle(el, 'lineHeight')),
      amount:   1,
      negative: direction.split('+').includes('down'),
    }))
    .map(payload =>
      Object.assign(payload, {
        current: payload.current == 'normal' || isNaN(payload.current)
          ? 1.14 * parseInt(getStyle(payload.el, 'fontSize')) // document this choice
          : payload.current
      }))
    .map(payload =>
      Object.assign(payload, {
        value: payload.negative
          ? payload.current - payload.amount
          : payload.current + payload.amount
      }))
    .forEach(({el, style, value}) =>
      el.style[style] = `${value}px`)
}

export function changeKerning(els, direction) {
  els
    .map(el => showHideSelected(el))
    .map(el => ({
      el,
      style:    'letterSpacing',
      current:  parseFloat(getStyle(el, 'letterSpacing')),
      amount:   .1,
      negative: direction.split('+').includes('left'),
    }))
    .map(payload =>
      Object.assign(payload, {
        current: payload.current == 'normal' || isNaN(payload.current)
          ? 0
          : payload.current
      }))
    .map(payload =>
      Object.assign(payload, {
        value: payload.negative
          ? (payload.current - payload.amount).toFixed(2)
          : (payload.current + payload.amount).toFixed(2)
      }))
    .forEach(({el, style, value}) =>
      el.style[style] = `${value <= -2 ? -2 : value}px`)
}

export function changeFontSize(els, direction) {
  els
    .map(el => showHideSelected(el))
    .map(el => ({
      el,
      style:    'fontSize',
      current:  parseInt(getStyle(el, 'fontSize')),
      amount:   direction.split('+').includes('shift') ? 10 : 1,
      negative: direction.split('+').includes('down'),
    }))
    .map(payload =>
      Object.assign(payload, {
        font_size: payload.negative
          ? payload.current - payload.amount
          : payload.current + payload.amount
      }))
    .forEach(({el, style, font_size}) =>
      el.style[style] = `${font_size <= 6 ? 6 : font_size}px`)
}

const weightMap = {
  normal: 2,
  bold:   5,
  light:  0,
  "": 2,
  "100":0,"200":1,"300":2,"400":3,"500":4,"600":5,"700":6,"800":7,"900":8
}
const weightOptions = [100,200,300,400,500,600,700,800,900]

export function changeFontWeight(els, direction) {
  els
    .map(el => showHideSelected(el))
    .map(el => ({
      el,
      style:    'fontWeight',
      current:  getStyle(el, 'fontWeight'),
      direction: direction.split('+').includes('down'),
    }))
    .map(payload =>
      Object.assign(payload, {
        value: payload.direction
          ? weightMap[payload.current] - 1
          : weightMap[payload.current] + 1
      }))
    .forEach(({el, style, value}) =>
      el.style[style] = weightOptions[value < 0 ? 0 : value >= weightOptions.length
        ? weightOptions.length
        : value
      ])
}

const alignMap = {
  start: 0,
  left: 0,
  center: 1,
  right: 2,
}
const alignOptions = ['left','center','right']

export function changeAlignment(els, direction) {
  els
    .map(el => showHideSelected(el))
    .map(el => ({
      el,
      style:    'textAlign',
      current:  getStyle(el, 'textAlign'),
      direction: direction.split('+').includes('left'),
    }))
    .map(payload =>
      Object.assign(payload, {
        value: payload.direction
          ? alignMap[payload.current] - 1
          : alignMap[payload.current] + 1
      }))
    .forEach(({el, style, value}) =>
      el.style[style] = alignOptions[value < 0 ? 0 : value >= 2 ? 2: value])
}

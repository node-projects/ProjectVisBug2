import test from 'ava'

import {setupPptrTab, teardownPptrTab} from '../../../tests/helpers.js'

test.beforeEach(setupPptrTab)

test('Should show all export formats in the selection actions menu', async t => {
  const {page} = t.context
  await page.click('[intro]')

  const actions = await page.evaluate(() => {
    const handles = document.querySelector('visbug-handles')
    const menu = handles.$shadow.querySelector('visbug-selection-actions')
    const shadow = menu.$shadow
    shadow.querySelector('.trigger').click()
    shadow.querySelector('.group').dispatchEvent(new PointerEvent('pointerenter'))
    return {
      hidden: menu.hidden,
      group: shadow.querySelector('.group').firstChild.textContent,
      rootOpen: shadow.querySelector('.menu').matches(':popover-open'),
      submenuOpen: shadow.querySelector('.submenu-items').matches(':popover-open'),
      formats: Array.from(shadow.querySelectorAll('.submenu-items [data-command]'))
        .map(button => button.textContent),
    }
  })

  t.deepEqual(actions, {
    hidden: false,
    group: 'Export',
    rootOpen: true,
    submenuOpen: true,
    formats: [
      'SVG', 'DXF', 'DXF (AutoCAD)', 'DWG', 'EMF', 'EMF+',
      'PDF', 'HTML', 'PNG', 'JPEG', 'WebP',
    ],
  })
})

test('Should hide when no contributing plug-in is active', async t => {
  const {page} = t.context
  await page.click('[intro]')

  const hidden = await page.evaluate(() => {
    const visbug = document.querySelector('vis-bug')
    visbug.setPluginActive('export', false)
    visbug.setPluginActive('projective-transform', false)
    const handles = document.querySelector('visbug-handles')
    const result = handles.$shadow
      .querySelector('visbug-selection-actions').hidden
    visbug.setPluginActive('export', true)
    visbug.setPluginActive('projective-transform', true)
    return result
  })

  t.true(hidden)
})

test('Should stay anchored while hovering other elements', async t => {
  const {page} = t.context
  await page.click('article:nth-of-type(2)')

  const before = await page.evaluate(() => {
    const shadow = document.querySelector('visbug-handles').$shadow
      .querySelector('visbug-selection-actions').$shadow
    shadow.querySelector('.trigger').click()
    shadow.querySelector('.group').dispatchEvent(new PointerEvent('pointerenter'))
    const bounds = shadow.querySelector('.submenu-items').getBoundingClientRect()
    return {open: true, x: bounds.x, y: bounds.y}
  })
  const hoverTarget = await page.$eval('article:nth-of-type(4)', element => {
    const bounds = element.getBoundingClientRect()
    return {x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2}
  })
  await page.mouse.move(hoverTarget.x, hoverTarget.y)
  const after = await page.evaluate(() => {
    const shadow = document.querySelector('visbug-handles').$shadow
      .querySelector('visbug-selection-actions').$shadow
    const submenu = shadow.querySelector('.submenu-items')
    const bounds = submenu.getBoundingClientRect()
    return {open: submenu.matches(':popover-open'), x: bounds.x, y: bounds.y}
  })

  t.deepEqual(after, before)
})

test('Should flip the export submenu left at the viewport edge', async t => {
  const {page} = t.context
  const placement = await page.evaluate(async () => {
    const source = document.createElement('div')
    source.style.cssText = 'position:fixed;inset:10rem 4px auto auto;width:5rem;height:5rem'
    document.body.appendChild(source)
    document.querySelector('vis-bug').selectorEngine.select(source)
    const shadow = document.querySelector('visbug-handles').$shadow
      .querySelector('visbug-selection-actions').$shadow
    shadow.querySelector('.trigger').click()
    shadow.querySelector('.group').dispatchEvent(new PointerEvent('pointerenter'))
    await new Promise(resolve => requestAnimationFrame(resolve))
    const group = shadow.querySelector('.group').getBoundingClientRect()
    const submenu = shadow.querySelector('.submenu-items').getBoundingClientRect()
    return {
      isLeft: submenu.right <= group.left,
      isInsideViewport: submenu.left >= 0 && submenu.right <= innerWidth,
    }
  })

  t.deepEqual(placement, {isLeft: true, isInsideViewport: true})
})

test('Should run add-on actions without selecting content below', async t => {
  const {page} = t.context
  await page.click('[intro]')

  const action = await page.evaluate(async () => {
    const visbug = document.querySelector('vis-bug')
    window.__testSelectionBefore = visbug.selectorEngine.selection()[0]
    window.__testSelectionActionController = visbug.registerPlugin({
      id: 'test-selection-action',
      commands: ['test-selection-action'],
      execute: ({source}) => { window.__testSelectionActionResult = source.localName },
      selectionActions: [{
        id: 'test-selection-action',
        label: 'Test action',
        command: 'test-selection-action',
        order: 200,
      }],
    })
    const menu = document.querySelector('visbug-handles').$shadow
      .querySelector('visbug-selection-actions')
    const button = menu.$shadow.querySelector('[data-command="test-selection-action"]')
    menu.$shadow.querySelector('.trigger').click()
    await new Promise(resolve => requestAnimationFrame(resolve))
    const bounds = button.getBoundingClientRect()
    return {
      label: button.textContent,
      sourceName: window.__testSelectionBefore.localName,
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    }
  })

  await page.mouse.move(action.x, action.y)
  const beforeClick = await page.evaluate(({x, y}) => {
    const handles = document.querySelector('visbug-handles')
    const menu = handles.$shadow.querySelector('visbug-selection-actions')
    const shadow = menu.$shadow
    return {
      actionsOpen: handles.actionsOpen,
      rootOpen: shadow.querySelector('.menu').matches(':popover-open'),
      hit: shadow.elementFromPoint(x, y)?.textContent,
    }
  }, action)
  t.deepEqual(beforeClick, {
    actionsOpen: true,
    rootOpen: true,
    hit: 'Test action',
  })
  await page.mouse.click(action.x, action.y)
  await page.waitForFunction(() => window.__testSelectionActionResult)
  const result = await page.evaluate(() => {
    const visbug = document.querySelector('vis-bug')
    const selected = visbug.selectorEngine.selection()
    window.__testSelectionActionController.unregister()
    return {
      value: window.__testSelectionActionResult,
      selected: selected.length,
      selectionPreserved: selected[0] === window.__testSelectionBefore,
    }
  })

  t.is(action.label, 'Test action')
  t.deepEqual(result, {
    value: action.sourceName,
    selected: 1,
    selectionPreserved: true,
  })
})

test('Should export from a nested menu item without selecting content below', async t => {
  const {page} = t.context
  await page.click('[intro]')

  const action = await page.evaluate(async () => {
    const visbug = document.querySelector('vis-bug')
    const source = visbug.selectorEngine.selection()[0]
    const menu = document.querySelector('visbug-handles').$shadow
      .querySelector('visbug-selection-actions')
    const shadow = menu.$shadow

    window.__nestedExportSelection = source
    window.__nestedExportOriginalPicker = window.showSaveFilePicker
    window.__nestedExportBytes = 0
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async blob => { window.__nestedExportBytes = blob.size },
        close: async () => {},
      }),
    })
    source.addEventListener('visbug-export-complete', ({detail}) => {
      window.__nestedExportComplete = detail
    }, {once: true})

    shadow.querySelector('.trigger').click()
    shadow.querySelector('.group').dispatchEvent(new PointerEvent('pointerenter'))
    await new Promise(resolve => requestAnimationFrame(resolve))
    const button = shadow.querySelector('[data-command="export-svg"]')
    const bounds = button.getBoundingClientRect()
    return {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    }
  })

  await page.mouse.move(action.x, action.y)
  await page.mouse.click(action.x, action.y)
  await page.waitForFunction(() => window.__nestedExportComplete)

  const result = await page.evaluate(() => {
    const visbug = document.querySelector('vis-bug')
    const selected = visbug.selectorEngine.selection()
    const result = {
      format: window.__nestedExportComplete.format,
      bytes: window.__nestedExportBytes,
      selectionPreserved: selected.length === 1
        && selected[0] === window.__nestedExportSelection,
    }
    if (window.__nestedExportOriginalPicker)
      window.showSaveFilePicker = window.__nestedExportOriginalPicker
    else
      delete window.showSaveFilePicker
    return result
  })

  t.is(result.format, 'svg')
  t.true(result.bytes > 0)
  t.true(result.selectionPreserved)
})

test.afterEach.always(teardownPptrTab)

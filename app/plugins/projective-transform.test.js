import test from 'ava'
import {
  setupPptrTab, teardownPptrTab, pptrMetaKey
} from '../../tests/helpers.js'

const target = 'h2[style*="text-shadow"]'

const shortcut = async (page, modifier, {shift = false} = {}) => {
  await page.keyboard.down(modifier)
  if (shift) await page.keyboard.down('Shift')
  await page.keyboard.press('KeyZ')
  if (shift) await page.keyboard.up('Shift')
  await page.keyboard.up(modifier)
}

const overlayMatchesSource = target => {
  const source = document.querySelector(target)
  const overlay = document.querySelector('visbug-projective-transform')
  if (!source || !overlay) return false

  const quad = source.getBoxQuads()[0]
  const sourcePoints = [quad.p1, quad.p2, quad.p3, quad.p4]
  const overlayPoints = Array.from(overlay.$shadow.querySelectorAll('[data-corner]'))
    .filter(element => element.tagName === 'g')
    .map(group => {
      const matrix = group.transform.baseVal.consolidate().matrix
      return {x: matrix.e, y: matrix.f}
    })

  return overlayPoints.every((point, index) =>
    Math.abs(point.x - sourcePoints[index].x) < .1
    && Math.abs(point.y - sourcePoints[index].y) < .1)
}

test.beforeEach(setupPptrTab)
test.afterEach.always(teardownPptrTab)

test('shows four projective handles and supports undo and redo', async t => {
  const {page} = t.context
  const modifier = await pptrMetaKey(page)

  await page.click(target)
  await page.$eval(target, element =>
    document.querySelector('vis-bug').execCommand('3d-transform', {source: element}))

  const overlays = await page.evaluate(() => ({
    projective: document.querySelectorAll('visbug-projective-transform').length,
    regular: Array.from(document.querySelectorAll(
      'visbug-handles, visbug-label, visbug-rotation, visbug-hover'
    )).filter(element => getComputedStyle(element).display !== 'none').length,
    handles: document.querySelector('visbug-projective-transform')
      .$shadow.querySelectorAll('.handle').length,
    crosses: document.querySelector('visbug-projective-transform')
      .$shadow.querySelectorAll('.cross').length,
  }))

  t.deepEqual(overlays, {
    projective: 1,
    regular: 0,
    handles: 4,
    crosses: 8,
  })

  const handle = await page.$eval('visbug-projective-transform', overlay => {
    const rect = overlay.$shadow.querySelector('.handle').getBoundingClientRect()
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2}
  })

  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x + 35, handle.y + 20, {steps: 4})
  await page.mouse.up()

  const transformed = await page.$eval(target, element => element.style.transform)
  t.regex(transformed, /matrix3d\(/)
  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 1)

  await shortcut(page, modifier)
  t.is(await page.$eval(target, element => element.style.transform), '')
  await page.waitForFunction(overlayMatchesSource, {}, target)

  await shortcut(page, modifier, {shift: true})
  t.is(await page.$eval(target, element => element.style.transform), transformed)

  await page.click('article:nth-of-type(2)')
  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 0)
  t.is(await page.$$('visbug-handles').then(items => items.length), 1)
})

test('tracks undo through a transform transition', async t => {
  const {page} = t.context
  await page.$eval(target, element => {
    element.style.transition = 'transform 150ms linear'
  })
  await page.click(target)
  await page.$eval(target, element =>
    document.querySelector('vis-bug').execCommand('3d-transform', {source: element}))

  const handle = await page.$eval('visbug-projective-transform', overlay => {
    const rect = overlay.$shadow.querySelector('.handle').getBoundingClientRect()
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2}
  })
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x + 30, handle.y + 20, {steps: 3})
  await page.mouse.up()

  await page.evaluate(() => document.querySelector('vis-bug').history.undo())
  await page.waitForFunction(overlayMatchesSource, {}, target)

  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 1)
})

test('changing tools closes the projective overlay', async t => {
  const {page} = t.context
  await page.click(target)
  await page.$eval(target, element =>
    document.querySelector('vis-bug').execCommand('3d-transform', {source: element}))

  await page.evaluate(() => document.querySelector('vis-bug').toolSelected('margin'))

  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 0)
})

test('selection action replaces the regular selection overlays', async t => {
  const {page} = t.context
  await page.click(target)

  const action = await page.evaluate(async () => {
    const menu = document.querySelector('visbug-handles').$shadow
      .querySelector('visbug-selection-actions')
    const shadow = menu.$shadow
    shadow.querySelector('.trigger').click()
    await new Promise(resolve => requestAnimationFrame(resolve))
    const button = shadow.querySelector('[data-command="3d-transform"]')
    const bounds = button.getBoundingClientRect()
    return {x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2}
  })

  await page.mouse.move(action.x, action.y)
  await page.mouse.down()
  await new Promise(resolve => setTimeout(resolve, 75))
  await page.mouse.up()
  await page.waitForSelector('visbug-projective-transform')

  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 1)
  const regularOverlaysHidden = await page.$$eval(
    'visbug-handles, visbug-rotation',
    elements => elements.every(element => getComputedStyle(element).display === 'none'))
  t.true(regularOverlaysHidden)

  await page.click(target)
  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 0)
  t.is(await page.$$('visbug-handles').then(items => items.length), 1)
})

test('dragging on a scrolled page keeps the opposite corner in place', async t => {
  const {page} = t.context
  const before = await page.evaluate(() => {
    const source = document.createElement('button')
    source.id = 'scrolled-projective-target'
    source.textContent = 'Transform me'
    source.style.cssText = 'position:absolute;left:120px;top:2200px;width:160px;height:70px'
    document.body.appendChild(source)
    window.scrollTo(0, 2050)

    const visbug = document.querySelector('vis-bug')
    visbug.selectorEngine.select(source)
    visbug.execCommand('3d-transform', {source})
    const quad = source.getBoxQuads()[0]
    return {x: quad.p3.x, y: quad.p3.y}
  })

  const handle = await page.$eval('visbug-projective-transform', overlay => {
    const rect = overlay.$shadow.querySelector('.handle').getBoundingClientRect()
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2}
  })
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x + 25, handle.y + 15, {steps: 3})
  await page.mouse.up()

  const after = await page.$eval('#scrolled-projective-target', source => {
    const quad = source.getBoxQuads()[0]
    return {x: quad.p3.x, y: quad.p3.y}
  })

  t.true(Math.abs(after.x - before.x) < .1)
  t.true(Math.abs(after.y - before.y) < .1)
  t.is(await page.$$('visbug-projective-transform').then(items => items.length), 1)
})

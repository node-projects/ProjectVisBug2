import test from 'ava'
import {
  setupPptrTab, teardownPptrTab, changeMode, pptrMetaKey
} from '../../tests/helpers.js'

const target = 'h2[style*="text-shadow"]'
const shortcut = async (page, modifier, {shift = false} = {}) => {
  await page.keyboard.down(modifier)
  if (shift) await page.keyboard.down('Shift')
  await page.keyboard.press('KeyZ')
  if (shift) await page.keyboard.up('Shift')
  await page.keyboard.up(modifier)
}
const geometryNumbers = outline => Object.values(outline)
  .flatMap(value => value.match(/-?\d+(?:\.\d+)?/g) || [])
  .map(Number)
const assertOutlineClose = (t, actual, expected) => {
  const actualNumbers = geometryNumbers(actual)
  const expectedNumbers = geometryNumbers(expected)
  t.is(actualNumbers.length, expectedNumbers.length)
  actualNumbers.forEach((value, index) =>
    t.true(Math.abs(value - expectedNumbers[index]) < .01))
}

test.beforeEach(setupPptrTab)
test.afterEach.always(teardownPptrTab)

test('style, DOM, and rotation edits can be undone and redone', async t => {
  const {page} = t.context
  const modifier = await pptrMetaKey(page)

  await changeMode({page, tool: 'margin'})
  await page.click(target)
  await page.keyboard.press('ArrowUp')
  t.is(await page.$eval(target, el => el.style.marginTop), '1px')
  await shortcut(page, modifier)
  t.is(await page.$eval(target, el => el.style.marginTop), '')
  await shortcut(page, modifier, {shift: true})
  t.is(await page.$eval(target, el => el.style.marginTop), '1px')

  const count = await page.$$eval(target, els => els.length)
  await page.keyboard.down(modifier)
  await page.keyboard.press('KeyD')
  await page.keyboard.up(modifier)
  t.is(await page.$$eval(target, els => els.length), count + 1)
  await shortcut(page, modifier)
  t.is(await page.$$eval(target, els => els.length), count)
  await shortcut(page, modifier, {shift: true})
  t.is(await page.$$eval(target, els => els.length), count + 1)

  const originalHandle = await page.$eval('visbug-rotation', rotation => {
    const rect = rotation.$shadow.querySelector('.rotation-handle').getBoundingClientRect()
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2}
  })
  const originalOutline = await page.$eval('visbug-handles', handles => ({
    path: handles.$shadow.querySelector('path').getAttribute('d'),
    top: handles.style.getPropertyValue('--top'),
    left: handles.style.getPropertyValue('--left'),
    width: handles.style.getPropertyValue('--width'),
    height: handles.style.getPropertyValue('--height'),
  }))
  await page.mouse.move(originalHandle.x, originalHandle.y)
  await page.mouse.down()
  await page.mouse.move(originalHandle.x + 40, originalHandle.y + 30, {steps: 4})
  await page.mouse.up()

  const rotated = await page.$eval(target, el => el.style.transform)
  t.regex(rotated, /rotate\(/)
  const rotatedOutline = await page.$eval('visbug-handles', handles => ({
    path: handles.$shadow.querySelector('path').getAttribute('d'),
    top: handles.style.getPropertyValue('--top'),
    left: handles.style.getPropertyValue('--left'),
    width: handles.style.getPropertyValue('--width'),
    height: handles.style.getPropertyValue('--height'),
  }))
  await page.$eval('body', body => body.removeAttribute('testing'))
  await shortcut(page, modifier)
  await page.waitForFunction(({target, originalOutline}) => {
    const handles = document.querySelector('visbug-handles')
    if (!handles) return false
    const outline = {
      path: handles.$shadow.querySelector('path').getAttribute('d'),
      top: handles.style.getPropertyValue('--top'),
      left: handles.style.getPropertyValue('--left'),
      width: handles.style.getPropertyValue('--width'),
      height: handles.style.getPropertyValue('--height'),
    }
    return document.querySelector(target).style.transform === ''
      && JSON.stringify(outline) === JSON.stringify(originalOutline)
  }, {}, {target, originalOutline})
  t.is(await page.$eval(target, el => el.style.transform), '')
  const refreshedHandle = await page.$eval('visbug-rotation', rotation => {
    const rect = rotation.$shadow.querySelector('.rotation-handle').getBoundingClientRect()
    return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2}
  })
  t.deepEqual(refreshedHandle, originalHandle)
  const refreshedOutline = await page.$eval('visbug-handles', handles => ({
    path: handles.$shadow.querySelector('path').getAttribute('d'),
    top: handles.style.getPropertyValue('--top'),
    left: handles.style.getPropertyValue('--left'),
    width: handles.style.getPropertyValue('--width'),
    height: handles.style.getPropertyValue('--height'),
  }))
  t.deepEqual(refreshedOutline, originalOutline)
  await shortcut(page, modifier, {shift: true})
  await new Promise(resolve => setTimeout(resolve, 500))
  t.is(await page.$eval(target, el => el.style.transform), rotated)
  const redoneOutline = await page.$eval('visbug-handles', handles => ({
    path: handles.$shadow.querySelector('path').getAttribute('d'),
    top: handles.style.getPropertyValue('--top'),
    left: handles.style.getPropertyValue('--left'),
    width: handles.style.getPropertyValue('--width'),
    height: handles.style.getPropertyValue('--height'),
  }))
  assertOutlineClose(t, redoneOutline, rotatedOutline)
})

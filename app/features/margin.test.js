import test from 'ava'

import { setupPptrTab, teardownPptrTab, changeMode, getActiveTool } 
from '../../tests/helpers.js'

const tool            = 'margin'
const test_selector   = '[intro] b'

const getMarginTop = async page =>
  await page.$eval(test_selector, el => 
    el.style.marginTop)

test.beforeEach(async t => {
  await setupPptrTab(t)

  await changeMode({
    tool,
    page: t.context.page,
  })
})

test('Can Be Activated', async t => {
  const { page } = t.context
  t.is(await getActiveTool(page), tool)
  t.pass()
})

test('Can Be Deactivated', async t => {
  const { page } = t.context

  t.is(await getActiveTool(page), tool)
  await changeMode({ tool: 'padding', page })
  t.is(await getActiveTool(page), 'padding')

  t.pass()
})

test('Adds margin to side', async t => {
  const { page } = t.context

  await page.click(test_selector)

  t.is(await getMarginTop(page), '')

  await page.keyboard.press('ArrowUp')

  t.is(await getMarginTop(page), '1px')

  t.pass()
})

test('Remove margin from side', async t => {
  const { page } = t.context

  await page.click(test_selector)
  t.is(await getMarginTop(page), '')

  await page.keyboard.press('ArrowUp')
  t.is(await getMarginTop(page), '1px')

  await page.keyboard.down('Alt')
  await page.keyboard.down('ArrowUp')
  await page.keyboard.up('Alt')
  await page.keyboard.up('ArrowUp')
  t.is(await getMarginTop(page), '0px')

  t.pass()
})

test('Can change values by 10 with shift key', async t => {
  const { page } = t.context

  await page.click(test_selector)
  t.is(await getMarginTop(page), '')

  await page.keyboard.down('Shift')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.up('Shift')
  t.is(await getMarginTop(page), '10px')

  t.pass()
})

test('Keeps the box-model overlay visible and updates it in place', async t => {
  const { page } = t.context

  await page.click(test_selector)
  await page.evaluate(() => {
    const handles = document.querySelector('visbug-handles')
    window.marginBoxModel = handles.$shadow.querySelector('visbug-boxmodel')
  })

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowUp')
    const overlay = await page.$eval('visbug-handles', handles => ({
      visible: handles.style.display !== 'none',
      connected: window.marginBoxModel.isConnected,
      sameNode: handles.$shadow.querySelector('visbug-boxmodel') === window.marginBoxModel,
    }))

    t.deepEqual(overlay, {visible: true, connected: true, sameNode: true})
  }
})

test.afterEach.always(teardownPptrTab)

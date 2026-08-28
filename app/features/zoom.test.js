import test from 'ava'
import { setupPptrTab, teardownPptrTab, pptrMetaKey } from '../../tests/helpers.js'

test.beforeEach(setupPptrTab)

test('Artboard mode zooms and restores the document', async t => {
  const {page} = t.context

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--site-owned-value', 'kept')
    document.querySelector('vis-bug').setAttribute('viewmode', 'artboard')
  })

  t.true(await page.$eval('html', html => html.hasAttribute('data-visbug-artboard')))

  const metaKey = await pptrMetaKey(page)
  await page.keyboard.down(metaKey)
  await page.keyboard.press('=')
  await page.keyboard.up(metaKey)
  await new Promise(resolve => setTimeout(resolve, 180))

  const transform = await page.$eval('body', body => getComputedStyle(body).transform)
  t.not(transform, 'none')

  await page.click('[intro] h1')
  await page.keyboard.down(metaKey)
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await page.keyboard.up(metaKey)
  await new Promise(resolve => setTimeout(resolve, 50))
  t.true(await page.$eval('[intro] h1', node => node.hasAttribute('data-selected')))

  await page.$eval('vis-bug', visbug => visbug.setAttribute('viewmode', 'document'))

  const restored = await page.evaluate(() => ({
    artboard: document.documentElement.hasAttribute('data-visbug-artboard'),
    siteValue: document.documentElement.style.getPropertyValue('--site-owned-value'),
    transform: getComputedStyle(document.body).transform,
  }))

  t.false(restored.artboard)
  t.is(restored.siteValue, 'kept')
  t.is(restored.transform, 'none')
})

test.afterEach.always(teardownPptrTab)

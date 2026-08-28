import test from 'ava'

import { setupPptrTab, teardownPptrTab }
from '../../tests/helpers.js'

test.beforeEach(setupPptrTab)

test('Enter executes a keyboard-selected command and can execute it again', async t => {
  const { page } = t.context

  const executions = await page.evaluate(async () => {
    const visbug = document.querySelector('vis-bug')
    let count = 0

    visbug.registerPlugin({
      id: 'search-enter-test',
      commands: ['search-enter-test'],
      execute: () => count++,
    })
    visbug.toolSelected('search')

    const input = visbug.$shadow.querySelector('[data-tool="search"] input')
    input.focus()
    input.value = '/search-enter'
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    }))

    // Native datalist selection commits its highlighted value after keydown.
    input.value = '/search-enter-test'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve))

    input.blur()
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    }))
    await new Promise(resolve => setTimeout(resolve))

    return count
  })

  t.is(executions, 2)
})

test.afterEach.always(teardownPptrTab)

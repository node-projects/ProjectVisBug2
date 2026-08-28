import test from 'ava'

import { setupPptrTab, teardownPptrTab } from '../../tests/helpers.js'

test.beforeEach(setupPptrTab)

test('Should export a selected element to every supported format', async t => {
  const {page} = t.context
  const formats = [
    'svg', 'dxf', 'acad-dxf', 'dwg', 'emf', 'emf-plus',
    'pdf', 'html', 'png', 'jpeg', 'webp',
  ]

  const result = await page.evaluate(async formats => {
    const visbug = document.querySelector('vis-bug')
    const source = document.createElement('div')
    const downloads = []
    const saved = []
    const originalClick = HTMLAnchorElement.prototype.click
    const originalPicker = window.showSaveFilePicker

    source.id = 'export-test'
    source.textContent = 'Export test'
    source.style.cssText = `
      width: 120px;
      height: 60px;
      padding: 8px;
      color: white;
      background: rebeccapurple;
      border: 2px solid hotpink;
      border-radius: 8px;
    `
    document.body.appendChild(source)
    HTMLAnchorElement.prototype.click = function() {
      downloads.push(this.download)
    }
    window.showSaveFilePicker = async options => ({
      createWritable: async () => ({
        write: async blob => saved.push({
          filename: options.suggestedName,
          type: blob.type,
          size: blob.size,
        }),
        close: async () => {},
      }),
    })

    try {
      const handles = document.createElement('visbug-handles')
      handles.position = {el: source, node_label_id: 'export-test'}
      document.body.appendChild(handles)
      const menu = handles.$shadow.querySelector('visbug-selection-actions').$shadow
      const firstExport = new Promise((resolve, reject) => {
        source.addEventListener('visbug-export-complete', ({detail}) =>
          resolve(detail), {once: true})
        source.addEventListener('visbug-export-error', ({detail}) =>
          reject(detail.error), {once: true})
      })
      menu.querySelector('.trigger').click()
      menu.querySelector('.group').click()
      menu.querySelector('[data-command="export-svg"]').click()

      const exports = [await firstExport]
      // Exercise the download fallback for the remaining formats even when the
      // browser itself exposes the File System Access API.
      delete window.showSaveFilePicker
      for (const format of formats.slice(1))
        exports.push(await visbug.execCommand(`export-${format}`, {source}))
      handles.remove()
      return {exports, downloads, saved}
    }
    finally {
      HTMLAnchorElement.prototype.click = originalClick
      if (originalPicker) window.showSaveFilePicker = originalPicker
      else delete window.showSaveFilePicker
      source.remove()
    }
  }, formats)

  t.deepEqual(result.exports.map(item => item.format), formats)
  t.is(result.saved.length, 1)
  t.is(result.saved[0].filename, 'export-test.svg')
  t.is(result.saved[0].type, 'image/svg+xml')
  t.true(result.saved[0].size > 0)
  t.deepEqual(result.downloads, [
    'export-test.dxf', 'export-test.dxf',
    'export-test.dwg', 'export-test.emf', 'export-test.emf',
    'export-test.pdf', 'export-test.html', 'export-test.png',
    'export-test.jpg', 'export-test.webp',
  ])
})

test.afterEach.always(teardownPptrTab)

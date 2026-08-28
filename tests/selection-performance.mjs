import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const appRoot = resolve(fileURLToPath(new URL('../app/', import.meta.url)))
const counts = process.argv.slice(2).map(Number).filter(Number.isFinite)
const sampleCounts = counts.length ? counts : [20, 40, 80, 160]
const iterations = Math.max(1, Number(process.env.VISBUG_PERF_ITERATIONS) || 5)
const bulkSelection = process.env.VISBUG_PERF_SELECT_MODE !== 'loop'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const filePath = resolve(appRoot, relativePath)

  if (filePath !== appRoot && !filePath.startsWith(`${appRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) throw new Error('Not a file')
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    })
    createReadStream(filePath).pipe(response)
  }
  catch {
    response.writeHead(404).end('Not found')
  }
})
const sockets = new Set()
server.on('connection', socket => {
  sockets.add(socket)
  socket.once('close', () => sockets.delete(socket))
})

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
const {port} = server.address()
const browser = await puppeteer.launch({
  args: ['--disable-background-timer-throttling', '--no-sandbox'],
  headless: true,
})

const metricNames = new Set([
  'LayoutCount',
  'LayoutDuration',
  'RecalcStyleCount',
  'RecalcStyleDuration',
  'TaskDuration',
])

const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

const metricsMap = metrics => Object.fromEntries(
  metrics.metrics
    .filter(({name}) => metricNames.has(name))
    .map(({name, value}) => [name, value]),
)

const subtractMetrics = (after, before) => Object.fromEntries(
  [...metricNames].map(name => [name, (after[name] || 0) - (before[name] || 0)]),
)

const samples = []

try {
  for (const count of sampleCounts) {
    for (let iteration = 0; iteration < iterations; iteration++) {
      const page = await browser.newPage()
      const session = await page.createCDPSession()
      await session.send('Performance.enable')
      await page.setRequestInterception(true)
      page.on('request', request => {
        const url = new URL(request.url())
        if (url.hostname === '127.0.0.1') request.continue()
        else request.abort()
      })
      await page.goto(`http://127.0.0.1:${port}`, {
        timeout: 60_000,
        waitUntil: 'domcontentloaded',
      })
      await page.waitForFunction(() =>
        Boolean(document.querySelector('vis-bug')?.selectorEngine))

      await page.evaluate(targetCount => {
        document.querySelector('vis-bug').toolSelected('search')
        const fixture = document.createElement('section')
        fixture.id = 'visbug-performance-fixture'
        fixture.style.cssText = 'display:grid;grid-template-columns:repeat(10,32px);gap:2px'
        fixture.innerHTML = Array.from({length: targetCount}, (_, index) =>
          `<button class="visbug-performance-target">${index}</button>`).join('')
        document.body.append(fixture)
      }, count)
      await page.evaluate(() => new Promise(resolveFrame =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame))))

      const before = metricsMap(await session.send('Performance.getMetrics'))
      const timing = await page.evaluate(async ({bulkSelection, targetCount}) => {
        const targets = Array.from(document.querySelectorAll('.visbug-performance-target'))
        const engine = document.querySelector('vis-bug').selectorEngine
        let rectReads = 0
        let bodyInsertions = 0
        const originalRect = Element.prototype.getBoundingClientRect
        const originalAppendChild = Node.prototype.appendChild
        const originalAppend = Element.prototype.append

        Element.prototype.getBoundingClientRect = function(...args) {
          rectReads++
          return originalRect.apply(this, args)
        }
        Node.prototype.appendChild = function(node) {
          if (this === document.body) bodyInsertions++
          return originalAppendChild.call(this, node)
        }
        Element.prototype.append = function(...nodes) {
          if (this === document.body) bodyInsertions++
          return originalAppend.apply(this, nodes)
        }

        const start = performance.now()
        if (bulkSelection) engine.select(targets)
        else targets.forEach(target => engine.select(target))
        const syncMs = performance.now() - start
        await new Promise(resolveFrame => requestAnimationFrame(resolveFrame))
        const frameMs = performance.now() - start

        Element.prototype.getBoundingClientRect = originalRect
        Node.prototype.appendChild = originalAppendChild
        Element.prototype.append = originalAppend

        return {
          bodyInsertions,
          frameMs,
          overlays: document.querySelectorAll(
            'visbug-handles, visbug-label, visbug-rotation').length,
          rectReads,
          selected: engine.selection().length,
          syncMs,
          targetCount,
        }
      }, {bulkSelection, targetCount: count})
      const after = metricsMap(await session.send('Performance.getMetrics'))
      samples.push({...timing, ...subtractMetrics(after, before)})
      await page.close()
    }
  }
}
finally {
  await browser.close()
  sockets.forEach(socket => socket.destroy())
  await new Promise((resolveClose, rejectClose) =>
    server.close(error => error ? rejectClose(error) : resolveClose()))
}

const summary = sampleCounts.map(count => {
  const group = samples.filter(sample => sample.targetCount === count)
  const result = {nodes: count}
  for (const key of [
    'syncMs', 'frameMs', 'TaskDuration', 'LayoutDuration',
    'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount',
    'rectReads', 'bodyInsertions', 'overlays',
  ]) result[key] = median(group.map(sample => sample[key]))
  return result
})

console.log(`Selection mode: ${bulkSelection ? 'bulk' : 'one call per node'}`)
console.table(summary.map(result => ({
  nodes: result.nodes,
  'sync ms': result.syncMs.toFixed(1),
  'frame ms': result.frameMs.toFixed(1),
  'task ms': (result.TaskDuration * 1000).toFixed(1),
  'layout ms': (result.LayoutDuration * 1000).toFixed(1),
  layouts: result.LayoutCount,
  'style ms': (result.RecalcStyleDuration * 1000).toFixed(1),
  styles: result.RecalcStyleCount,
  'rect reads': result.rectReads,
  'body inserts': result.bodyInsertions,
  overlays: result.overlays,
})))

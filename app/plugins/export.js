export const description = 'export a selected element to a vector, document, or image format'

const formats = [
  {id: 'svg', label: 'SVG', extension: 'svg', mimeType: 'image/svg+xml'},
  {id: 'dxf', label: 'DXF', extension: 'dxf', mimeType: 'application/dxf'},
  {id: 'acad-dxf', label: 'DXF (AutoCAD)', extension: 'dxf', mimeType: 'application/dxf'},
  {id: 'dwg', label: 'DWG', extension: 'dwg', mimeType: 'application/acad'},
  {id: 'emf', label: 'EMF', extension: 'emf', mimeType: 'image/emf'},
  {id: 'emf-plus', label: 'EMF+', extension: 'emf', mimeType: 'image/emf'},
  {id: 'pdf', label: 'PDF', extension: 'pdf', mimeType: 'application/pdf'},
  {id: 'html', label: 'HTML', extension: 'html', mimeType: 'text/html'},
  {id: 'png', label: 'PNG', extension: 'png', mimeType: 'image/png'},
  {id: 'jpeg', label: 'JPEG', extension: 'jpg', mimeType: 'image/jpeg'},
  {id: 'webp', label: 'WebP', extension: 'webp', mimeType: 'image/webp'},
]

export const commands = formats.map(format => `export-${format.id}`)

export const selectionActions = [
  {id: 'export', label: 'Export', order: 100},
  ...formats.map((format, index) => ({
    id: `export-${format.id}`,
    parentId: 'export',
    label: format.label,
    command: `export-${format.id}`,
    order: index,
  })),
]

let layout2vector

const loadLayout2Vector = () => {
  layout2vector ??= import('@node-projects/layout2vector')
  return layout2vector
}

const pxToMillimeters = pixels => pixels * 25.4 / 96

const safeFilename = element => {
  const hint = element.id
    || Array.from(element.classList)[0]
    || element.localName
    || 'element'

  return hint
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'element'
}

const createBlob = (data, mimeType) => data instanceof Blob
  ? data
  : new Blob([data], {type: mimeType})

const requestFileHandle = async (filename, format) => {
  if (typeof window.showSaveFilePicker !== 'function') return null

  try {
    return await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: `${format.label} file`,
        accept: {[format.mimeType]: [`.${format.extension}`]},
      }],
    })
  }
  catch (error) {
    if (error.name === 'AbortError') return false
    return null
  }
}

const save = async (data, filename, mimeType, fileHandle) => {
  const blob = createBlob(data, mimeType)

  if (fileHandle) {
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const getExportSize = element => {
  const bounds = element.getBoundingClientRect()
  return {
    width: Math.max(1, Math.ceil(Math.max(bounds.width, element.scrollWidth || 0))),
    height: Math.max(1, Math.ceil(Math.max(bounds.height, element.scrollHeight || 0))),
  }
}

const createWriter = (library, format, {width, height}, fontAssets) => {
  const vectorOptions = {width, height, fontAssets}

  switch (format.id) {
    case 'svg':
      return new library.SVGWriter({
        ...vectorOptions,
        fontMode: {type: 'inline'},
      })
    case 'dxf':
      return new library.DXFWriter({maxY: height})
    case 'acad-dxf':
      return new library.AcadDXFWriter({maxY: height})
    case 'dwg':
      return new library.DWGWriter({maxY: height})
    case 'emf':
      return new library.EMFWriter({width, height})
    case 'emf-plus':
      return new library.EMFPlusWriter({width, height})
    case 'pdf':
      return new library.PDFWriter({
        pageWidth: pxToMillimeters(width),
        pageHeight: pxToMillimeters(height),
        fontAssets,
      })
    case 'html':
      return new library.HTMLWriter({
        ...vectorOptions,
        fontMode: {type: 'inline'},
        imageMode: {type: 'inline'},
      })
    case 'png':
    case 'jpeg':
    case 'webp':
      return new library.ImageWriter({
        ...vectorOptions,
        scale: Math.max(1, window.devicePixelRatio || 1),
      })
    default:
      throw new Error(`Unsupported export format: ${format.id}`)
  }
}

const finalizeResult = async (format, result) => {
  if (format.id === 'pdf') {
    await result.finalize()
    return result.toBytes()
  }

  if (['png', 'jpeg', 'webp'].includes(format.id)) {
    await result.finalize()
    const quality = format.id === 'png' ? undefined : 0.92
    return result.toBytes(format.mimeType, quality)
  }

  return result
}

export default async function exportElement({selected, source, query}) {
  const element = source || selected[0]
  if (!element) throw new Error('Select an element before exporting')

  const formatId = query.replace(/^\/export-/, '')
  const format = formats.find(item => item.id === formatId)
  if (!format) throw new Error(`Unknown export format: ${formatId}`)

  element.dispatchEvent(new CustomEvent('visbug-export-start', {
    bubbles: true,
    detail: {format: format.id},
  }))

  try {
    const filename = `${safeFilename(element)}.${format.extension}`
    const fileHandle = await requestFileHandle(filename, format)
    if (fileHandle === false) return {format: format.id, cancelled: true}

    const library = await loadLayout2Vector()
    const size = getExportSize(element)
    const {ir, fontAssets} = await library.extractIRWithAssets(element, {
      includeFonts: true,
      includeImages: true,
      includeVideos: true,
      convertFormControls: true,
      rootScrollBehavior: 'expand',
    })
    const writer = createWriter(library, format, size, fontAssets)
    const result = await library.renderIR(ir, writer)
    const data = await finalizeResult(format, result)
    await save(data, filename, format.mimeType, fileHandle)
    element.dispatchEvent(new CustomEvent('visbug-export-complete', {
      bubbles: true,
      detail: {format: format.id, filename},
    }))

    return {format: format.id, filename}
  }
  catch (error) {
    element.dispatchEvent(new CustomEvent('visbug-export-error', {
      bubbles: true,
      detail: {format: format.id, error},
    }))
    throw error
  }
}

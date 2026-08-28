export const description = 'projectively transform a selected element by moving its corners'
export const commands = ['3d-transform']
export const selectionActions = [{
  id: '3d-transform',
  label: '3D transform',
  command: '3d-transform',
  order: 90,
}]

const selectionOverlays = [
  'visbug-handles',
  'visbug-label',
  'visbug-hover',
  'visbug-distance',
  'visbug-rotation',
  'visbug-grip',
  'visbug-corners',
].join(',')

export default function projectiveTransform({selected, source}) {
  const element = source || selected[0]
  if (!element) throw new Error('Select an element before using 3D transform')

  document.querySelectorAll('visbug-projective-transform')
    .forEach(overlay => overlay.remove())

  const overlay = document.createElement('visbug-projective-transform')
  overlay.source = element
  overlay.suppress_overlays(Array.from(
    document.querySelectorAll(selectionOverlays)))
  document.body.appendChild(overlay)
  return overlay
}

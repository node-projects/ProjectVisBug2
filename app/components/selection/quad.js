import { getBoxQuads as getPolyfillBoxQuads } from 'get-box-quads-polyfill'

export const quadBounds = quad => {
  const points = [quad.p1, quad.p2, quad.p3, quad.p4]
  const left   = Math.min(...points.map(point => point.x))
  const right  = Math.max(...points.map(point => point.x))
  const top    = Math.min(...points.map(point => point.y))
  const bottom = Math.max(...points.map(point => point.y))

  return {
    left,
    right,
    top,
    bottom,
    width:  right - left,
    height: bottom - top,
  }
}

export const quadPath = (quad, origin = {x: 0, y: 0}) =>
  `M${[quad.p1, quad.p2, quad.p3, quad.p4]
    .map(point => `${point.x - origin.x},${point.y - origin.y}`)
    .join(' ')}Z`

export const sideMidpoint = (quad, side) => {
  const [start, end] = {
    top:    [quad.p1, quad.p2],
    right:  [quad.p2, quad.p3],
    bottom: [quad.p4, quad.p3],
    left:   [quad.p1, quad.p4],
  }[side]

  return {
    x: start.x + ((end.x - start.x) / 2),
    y: start.y + ((end.y - start.y) / 2),
  }
}

export const quadCenter = quad => ({
  x: (quad.p1.x + quad.p2.x + quad.p3.x + quad.p4.x) / 4,
  y: (quad.p1.y + quad.p2.y + quad.p3.y + quad.p4.y) / 4,
})

export const pointOutsideQuad = (quad, side, distance) => {
  const midpoint = sideMidpoint(quad, side)
  const center = quadCenter(quad)
  const x = midpoint.x - center.x
  const y = midpoint.y - center.y
  const length = Math.hypot(x, y)

  if (!length) return midpoint

  return {
    x: midpoint.x + (x / length * distance),
    y: midpoint.y + (y / length * distance),
  }
}

const rectToQuad = ({left, right, top, bottom}) => ({
  p1: {x: left,  y: top},
  p2: {x: right, y: top},
  p3: {x: right, y: bottom},
  p4: {x: left,  y: bottom},
})

export const getBoxQuad = (element, box = 'border') => {
  try {
    const [quad] = element.getBoxQuads({box})
    if (quad) return quad
  }
  catch {}

  try {
    const [quad] = getPolyfillBoxQuads(element, {box})
    if (quad) return quad
  }
  catch {}

  return rectToQuad(element.getBoundingClientRect())
}

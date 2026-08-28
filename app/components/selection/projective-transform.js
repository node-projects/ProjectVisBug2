const EPSILON = 1e-8

export const splitTransformFunctions = transform => {
  const parts = []
  let startIndex = -1
  let depth = 0

  for (let index = 0; index < transform.length; index++) {
    const character = transform[index]

    if (character === '(') {
      depth++
    }
    else if (character === ')') {
      depth--
      if (depth === 0 && startIndex !== -1) {
        parts.push(transform.slice(startIndex, index + 1).trim())
        startIndex = -1
      }
    }
    else if (depth === 0 && startIndex === -1 && character.trim()) {
      startIndex = index
    }
  }

  if (!parts.length && transform.trim()) parts.push(transform.trim())
  return parts
}

export const parseProjectiveTransform = transform => {
  if (!transform || transform === 'none')
    return {baseTransform: '', projectiveTransform: ''}

  const parts = splitTransformFunctions(transform)
  const lastPart = parts.at(-1) || ''
  const functionName = lastPart
    .slice(0, lastPart.indexOf('('))
    .trim()
    .toLowerCase()

  if (functionName === 'matrix' || functionName === 'matrix3d') {
    return {
      baseTransform: parts.slice(0, -1).join(' ').trim(),
      projectiveTransform: lastPart,
    }
  }

  return {baseTransform: transform.trim(), projectiveTransform: ''}
}

export const projectiveMatrixValues = (points, width, height) => {
  if (!width || !height || points.length !== 4) return null

  const [p1, p2, p3, p4] = points
  const dx1 = p2.x - p3.x
  const dx2 = p4.x - p3.x
  const dx3 = p1.x - p2.x + p3.x - p4.x
  const dy1 = p2.y - p3.y
  const dy2 = p4.y - p3.y
  const dy3 = p1.y - p2.y + p3.y - p4.y
  let aUnit
  let bUnit
  let dUnit
  let eUnit
  let gUnit
  let hUnit

  if (Math.abs(dx3) < EPSILON && Math.abs(dy3) < EPSILON) {
    aUnit = p2.x - p1.x
    bUnit = p4.x - p1.x
    dUnit = p2.y - p1.y
    eUnit = p4.y - p1.y
    gUnit = 0
    hUnit = 0
  }
  else {
    const determinant = dx1 * dy2 - dx2 * dy1
    if (Math.abs(determinant) < EPSILON) return null

    gUnit = (dx3 * dy2 - dx2 * dy3) / determinant
    hUnit = (dx1 * dy3 - dx3 * dy1) / determinant
    aUnit = p2.x - p1.x + gUnit * p2.x
    bUnit = p4.x - p1.x + hUnit * p4.x
    dUnit = p2.y - p1.y + gUnit * p2.y
    eUnit = p4.y - p1.y + hUnit * p4.y
  }

  const values = [
    aUnit / width, dUnit / width, 0, gUnit / width,
    bUnit / height, eUnit / height, 0, hUnit / height,
    0, 0, 1, 0,
    p1.x, p1.y, 0, 1,
  ]

  return values.every(Number.isFinite) ? values : null
}

export const formatMatrixNumber = value => {
  if (Math.abs(value) < 1e-10) return '0'

  const rounded = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  return rounded === '-0' ? '0' : rounded
}

export const serializeMatrix3d = matrix => {
  const values = [
    matrix.m11, matrix.m12, matrix.m13, matrix.m14,
    matrix.m21, matrix.m22, matrix.m23, matrix.m24,
    matrix.m31, matrix.m32, matrix.m33, matrix.m34,
    matrix.m41, matrix.m42, matrix.m43, matrix.m44,
  ]

  return `matrix3d(${values.map(formatMatrixNumber).join(', ')})`
}

export const pointsApproximatelyEqual = (pointsA, pointsB) =>
  pointsA.length === pointsB.length
  && pointsA.every((point, index) => {
    const compareTo = pointsB[index]
    return Math.abs(point.x - compareTo.x) < .01
      && Math.abs(point.y - compareTo.y) < .01
  })

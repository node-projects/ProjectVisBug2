import test from 'ava'
import {
  parseProjectiveTransform,
  projectiveMatrixValues,
  splitTransformFunctions,
} from './projective-transform.js'

test('splits and identifies a trailing projective matrix', t => {
  const transform = 'translate(2px, 4px) rotate(10deg) matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 0, 1)'

  t.deepEqual(splitTransformFunctions(transform), [
    'translate(2px, 4px)',
    'rotate(10deg)',
    'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 0, 1)',
  ])
  t.deepEqual(parseProjectiveTransform(transform), {
    baseTransform: 'translate(2px, 4px) rotate(10deg)',
    projectiveTransform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 0, 1)',
  })
})

test('preserves non-matrix transforms as the base transform', t => {
  t.deepEqual(parseProjectiveTransform('rotate(12deg)'), {
    baseTransform: 'rotate(12deg)',
    projectiveTransform: '',
  })
})

test('creates an identity matrix for an unchanged rectangle', t => {
  const values = projectiveMatrixValues([
    {x: 0, y: 0},
    {x: 100, y: 0},
    {x: 100, y: 50},
    {x: 0, y: 50},
  ], 100, 50)

  t.deepEqual(values, [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
})

test('creates perspective terms when one corner moves', t => {
  const values = projectiveMatrixValues([
    {x: 15, y: 10},
    {x: 100, y: 0},
    {x: 100, y: 50},
    {x: 0, y: 50},
  ], 100, 50)

  t.truthy(values)
  t.true(values.every(Number.isFinite))
  t.true(Math.abs(values[3]) > 0 || Math.abs(values[7]) > 0)
})

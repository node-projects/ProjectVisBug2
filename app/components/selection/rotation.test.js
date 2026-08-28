import test from 'ava'
import { normalizeAngleDelta } from './rotation.js'

test('normalizes rotation across the positive angle boundary', t => {
  t.true(Math.abs(normalizeAngleDelta((2 * Math.PI) - 0.2) + 0.2) < 0.000001)
})

test('normalizes rotation across the negative angle boundary', t => {
  t.true(Math.abs(normalizeAngleDelta((-2 * Math.PI) + 0.2) - 0.2) < 0.000001)
})

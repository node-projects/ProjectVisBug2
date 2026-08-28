import test from 'ava'
import { screenDeltaToLocal } from './resize.js'

test('keeps resize deltas stable beyond 90 degrees of rotation', t => {
  const angle = 120 * (Math.PI / 180)
  const localOrigin = {x: 10, y: 20}
  const screenXLocal = {
    x: localOrigin.x + Math.cos(angle),
    y: localOrigin.y - Math.sin(angle),
  }
  const screenYLocal = {
    x: localOrigin.x + Math.sin(angle),
    y: localOrigin.y + Math.cos(angle),
  }
  const screenDelta = {
    x: 20 * Math.cos(angle),
    y: 20 * Math.sin(angle),
  }

  const localDelta = screenDeltaToLocal(
    screenDelta,
    localOrigin,
    screenXLocal,
    screenYLocal,
  )

  t.true(Math.abs(localDelta.x - 20) < 0.000001)
  t.true(Math.abs(localDelta.y) < 0.000001)
})

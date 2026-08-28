export const screenDeltaToLocal = (
  delta,
  localOrigin,
  screenXLocal,
  screenYLocal,
) => ({
  x: delta.x * (screenXLocal.x - localOrigin.x)
    + delta.y * (screenYLocal.x - localOrigin.x),
  y: delta.x * (screenXLocal.y - localOrigin.y)
    + delta.y * (screenYLocal.y - localOrigin.y),
})

export const getOverlayRoot = () =>
  document.documentElement.hasAttribute('data-visbug-artboard')
    ? document.documentElement
    : document.body

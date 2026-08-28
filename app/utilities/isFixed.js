export const isFixed = elem => {
  // A transformed body becomes the containing block for fixed descendants.
  if (document.documentElement.hasAttribute('data-visbug-artboard')) return false;

  do {
    if (window.getComputedStyle(elem).position == 'fixed') return true;
  } while (elem = elem.offsetParent);
  return false;
}

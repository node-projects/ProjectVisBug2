const visbug = document.querySelector('vis-bug')
if (visbug)
  document.documentElement.prepend(visbug)

if ('ontouchstart' in document.documentElement)
  document.getElementById('mobile-info').style.display = ''

const isMac = window.navigator.platform.includes('Mac')
if (!isMac)
  document.querySelectorAll('kbd').forEach(node => {
    node.textContent = node.textContent.replace('cmd', 'ctrl')
    node.textContent = node.textContent.replace('opt', 'alt')
  })

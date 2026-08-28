var platform = typeof browser === 'undefined'
  ? chrome
  : browser

const script = document.createElement('script')
script.type = 'module'
script.src = platform.runtime.getURL('toolbar/bundle.min.js')
document.body.appendChild(script)

const visbug = document.createElement('vis-bug')

const src_path = platform.runtime.getURL(`tuts/guides.gif`)
visbug.setAttribute('tutsBaseURL', src_path.slice(0, src_path.lastIndexOf('/')))

document.documentElement.prepend(visbug)

platform.runtime.onMessage.addListener(request => {
  const activeVisbug = document.querySelector('vis-bug')
  if (!activeVisbug) return

  if (request.action === 'COLOR_MODE')
    activeVisbug.setAttribute('color-mode', request.params.mode)
  else if (request.action === 'VIEW_MODE')
    activeVisbug.setAttribute('viewmode', request.params.mode)
  else if (request.action === 'COLOR_SCHEME')
    activeVisbug.setAttribute("color-scheme", request.params.mode)
})

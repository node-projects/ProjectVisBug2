const storageKey = 'visbug-view-mode'
const defaultMode = 'document'
const modes = ['document', 'artboard']

const state = {mode: defaultMode}

var platform = typeof browser === 'undefined'
  ? chrome
  : browser

const menuId = mode => `view-mode-${mode}`

const sendViewMode = () => {
  platform.tabs.query({active: true, currentWindow: true}, ([tab]) => {
    tab && platform.tabs.sendMessage(tab.id, {
      action: 'VIEW_MODE',
      params: {mode: state.mode},
    })?.catch?.(() => {})
  })
}

export const getViewMode = () => {
  platform.storage.sync.get([storageKey], value => {
    const found = modes.includes(value[storageKey])
      ? value[storageKey]
      : defaultMode

    if (found !== value[storageKey])
      platform.storage.sync.set({[storageKey]: found})

    modes.forEach(mode => {
      platform.contextMenus.update(menuId(mode), {checked: mode === found})
    })

    state.mode = found
    sendViewMode()
  })
}

getViewMode()

platform.contextMenus.create({
  id: 'view-mode',
  title: 'View mode',
  contexts: ['all'],
})

modes.forEach(mode => {
  platform.contextMenus.create({
    id: menuId(mode),
    parentId: 'view-mode',
    title: mode[0].toUpperCase() + mode.slice(1),
    checked: mode === defaultMode,
    type: 'radio',
    contexts: ['all'],
  })
})

platform.contextMenus.onClicked.addListener(({parentMenuItemId, menuItemId}) => {
  if (parentMenuItemId !== 'view-mode') return

  const mode = menuItemId.replace('view-mode-', '')
  if (!modes.includes(mode)) return

  state.mode = mode
  platform.storage.sync.set({[storageKey]: mode})
  sendViewMode()
})

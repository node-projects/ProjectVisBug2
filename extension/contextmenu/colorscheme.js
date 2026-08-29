const schemestoragekey = 'visbug-color-scheme';
const defaultcolorscheme = 'auto';

const scheme_option = [
  'auto',
  'light',
  'dark',
]

const colorschemestate = {
  mode: defaultcolorscheme
}

var platform = typeof browser === 'undefined'
  ? chrome
  : browser

const sendColorScheme = tab_id => {
  if (tab_id === undefined) return

  try {
    const pending_message = platform.tabs.sendMessage(tab_id, {
      action: 'COLOR_SCHEME',
      params: {mode:colorschemestate.mode},
    })

    // The tab can navigate or close before the message is delivered.
    pending_message?.catch?.(() => undefined)
  }
  catch {
    // Callback-based browser implementations throw instead of returning a promise.
  }
}

export const getColorScheme = tab_id => {
  platform.storage.sync.get([schemestoragekey], value => {
    let found_value = value[schemestoragekey];

    // first run
    if (!found_value) {
      found_value = defaultcolorscheme;
      platform.storage.sync.set({ [schemestoragekey]: defaultcolorscheme });
    }

    // update checked state of scheme contextmenu radio list
    scheme_option.forEach(option => {
      platform.contextMenus.update(option, {
        checked: option === found_value
      })
    })

    // send visbug user preference
    colorschemestate.mode = found_value
    sendColorScheme(tab_id)

    return found_value
  })
}

// load synced scheme choice on load
getColorScheme()

platform.contextMenus.create({
  id:     'color-scheme',
  title:  'Theme',
  contexts: ['all'],
})

scheme_option.forEach(option => {
  platform.contextMenus.create({
    id:       option,
    parentId: 'color-scheme',
    title:    ' '+option,
    checked:  false,
    type:     'radio',
    contexts: ['all'],
  })
})

platform.contextMenus.onClicked.addListener(({parentMenuItemId, menuItemId}, tab) => {
  if (parentMenuItemId !== 'color-scheme') return

  platform.storage.sync.set({[schemestoragekey]: menuItemId})
  colorschemestate.mode = menuItemId

  sendColorScheme(tab?.id)
})

import {gimmeToggle} from "./contextmenu/launcher.js"
import {getColorMode} from "./contextmenu/colormode.js"
import {getColorScheme} from "./contextmenu/colorscheme.js"

const state = {
  loaded:   {},
  injected: {},
}

var platform = typeof browser === 'undefined'
  ? chrome
  : browser

const toggleIn = async ({id:tab_id}) => {
  try {
    // toggle out: it's currently loaded and injected
    if (state.loaded[tab_id] && state.injected[tab_id]) {
      await platform.scripting.executeScript({
        target: {tabId: tab_id},
        files: ['toolbar/eject.js'],
      })
      state.injected[tab_id] = false
    }

    // toggle in: it's loaded and needs injected
    else if (state.loaded[tab_id] && !state.injected[tab_id]) {
      await platform.scripting.executeScript({
        target: {tabId: tab_id},
        files: ['toolbar/restore.js'],
      })
      state.injected[tab_id] = true
      getColorMode(tab_id)
      getColorScheme(tab_id)
    }

    // fresh start in tab
    else {
      await platform.scripting.insertCSS({
        target: {tabId: tab_id},
        files: ['toolbar/bundle.css' ],
      })
      await platform.scripting.executeScript({
        target: {tabId: tab_id},
        files: ['toolbar/inject.js'],
      })

      state.loaded[tab_id]    = true
      state.injected[tab_id]  = true
      getColorMode(tab_id)
      getColorScheme(tab_id)
    }
  }
  catch (error) {
    state.loaded[tab_id] = false
    state.injected[tab_id] = false
    console.error(`Could not toggle VisBug2 in tab ${tab_id}.`, error)
  }
}

platform.tabs.onUpdated.addListener((tab_id, change_info) => {
  if (change_info.status !== 'loading') return
  delete state.loaded[tab_id]
  delete state.injected[tab_id]
})

platform.tabs.onRemoved.addListener(tab_id => {
  delete state.loaded[tab_id]
  delete state.injected[tab_id]
})

gimmeToggle(toggleIn)

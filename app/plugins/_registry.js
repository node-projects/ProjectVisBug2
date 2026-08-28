import { commands as blank_page_commands, description as blank_page_description, default as BlankPagePlugin } from './blank-page'
import { commands as barrel_roll_commands, description as barrel_roll_description, default as BarrelRollPlugin } from './barrel-roll'
// import { commands as pesticide_commands, description as pesticide_description, default as PesticidePlugin } from './pesticide'
// import { commands as construct_commands, description as construct_description, default as ConstructPlugin } from './construct'
// import { commands as construct_debug_commands, description as construct_debug_description, default as ConstructDebugPlugin } from './construct.debug'
// import { commands as ct_head_scan_commands, description as ct_head_scan_description, default as CtHeadScanPlugin } from './ct-head-scan'
// import { commands as wireframe_commands, description as wireframe_description, default as WireframePlugin } from './wireframe'
// import { commands as skeleton_commands, description as skeleton_description, default as SkeletonPlugin } from './skeleton'
import { commands as tag_debugger_commands, description as tag_debugger_description, default as TagDebuggerPlugin } from './tag-debugger'
// import { commands as revenge_commands, description as revenge_description, default as RevengePlugin } from './revenge'
// import { commands as tota11y_commands, description as tota11y_description, default as Tota11yPlugin } from './tota11y'
import { commands as shuffle_commands, description as shuffle_description, default as ShufflePlugin } from './shuffle'
// import { commands as colorblind_commands, default as ColorblindPlugin } from './colorblind'
import { commands as zindex_commands, description as zindex_description, default as ZIndexPlugin } from './zindex'
// import { commands as no_mouse_days_commands, description as no_mouse_days_description, default as NoMouseDays } from './no-mouse-days'
import { commands as remove_css_commands, description as remove_css_description, default as RemoveCSSPlugin } from './remove-css'
import { commands as detect_overflows_commands, description as detect_overflows_description, default as DetectOverflows } from './detect-overflows'
import { commands as loop_thru_widths_commands, description as loop_thru_widths_description, default as LoopThruWidths } from './loop-through-widths'
// import { commands as placeholdifier_commands, description as placeholdifier_description, default as PlaceholdifierPlugin } from './placeholdifier'
import { commands as expand_text_commands, description as expand_text_description, default as ExpandTextPlugin } from './expand-text'
import {
  commands as export_commands,
  selectionActions as export_selection_actions,
  default as ExportPlugin
} from './export'

export const PluginRegistry = new Map()
export const SelectionActionRegistry = new Map()
export const PluginControllerRegistry = new Map()

const notifySelectionActionsChanged = () =>
  document.dispatchEvent(new CustomEvent('visbug-selection-actions-change'))

/**
 * Register a VisBug plug-in and any actions it contributes to selection menus.
 * Plug-ins are active by default and can be activated/deactivated at runtime.
 */
export const registerPlugin = ({
  id,
  commands = [],
  execute,
  selectionActions = [],
  active = true,
}) => {
  if (!id) throw new Error('A plug-in id is required')
  if (PluginControllerRegistry.has(id))
    throw new Error(`Plug-in already registered: ${id}`)
  if (commands.length && typeof execute !== 'function')
    throw new Error(`Plug-in "${id}" needs an execute function`)

  let isActive = false

  const activate = () => {
    if (isActive) return

    commands.forEach(command => {
      const query = command.startsWith('/') ? command : `/${command}`
      if (PluginRegistry.has(query))
        throw new Error(`Command already registered: ${query}`)
      PluginRegistry.set(query, execute)
    })

    selectionActions.forEach(action => {
      if (SelectionActionRegistry.has(action.id))
        throw new Error(`Selection action already registered: ${action.id}`)
      SelectionActionRegistry.set(action.id, {...action, pluginId: id})
    })

    isActive = true
    notifySelectionActionsChanged()
  }

  const deactivate = () => {
    if (!isActive) return

    commands.forEach(command => {
      const query = command.startsWith('/') ? command : `/${command}`
      if (PluginRegistry.get(query) === execute) PluginRegistry.delete(query)
    })

    selectionActions.forEach(action => {
      if (SelectionActionRegistry.get(action.id)?.pluginId === id)
        SelectionActionRegistry.delete(action.id)
    })

    isActive = false
    notifySelectionActionsChanged()
  }

  const controller = {
    activate,
    deactivate,
    unregister() {
      deactivate()
      PluginControllerRegistry.delete(id)
    },
    get active() { return isActive },
  }

  PluginControllerRegistry.set(id, controller)
  active && activate()

  return controller
}

export const setPluginActive = (id, active) => {
  const controller = PluginControllerRegistry.get(id)
  if (!controller) return false
  active ? controller.activate() : controller.deactivate()
  return true
}

export const getSelectionActions = () => {
  const actions = Array.from(SelectionActionRegistry.values())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return actions
    .filter(action => !action.parentId)
    .map(action => ({
      ...action,
      children: actions.filter(child => child.parentId === action.id),
    }))
}

const builtInPlugins = [
  {id: 'blank-page', commands: blank_page_commands, execute: BlankPagePlugin},
  {id: 'barrel-roll', commands: barrel_roll_commands, execute: BarrelRollPlugin},
  // ...commandsToHash(pesticide_commands, PesticidePlugin),
  // ...commandsToHash(construct_commands, ConstructPlugin),
  // ...commandsToHash(construct_debug_commands, ConstructDebugPlugin),
  // ...commandsToHash(ct_head_scan_commands, CtHeadScanPlugin),
  // ...commandsToHash(wireframe_commands, WireframePlugin),
  // ...commandsToHash(skeleton_commands, SkeletonPlugin),
  {id: 'tag-debugger', commands: tag_debugger_commands, execute: TagDebuggerPlugin},
  // ...commandsToHash(revenge_commands, RevengePlugin),
  // ...commandsToHash(tota11y_commands, Tota11yPlugin),
  {id: 'shuffle', commands: shuffle_commands, execute: ShufflePlugin},
  // ...commandsToHash(colorblind_commands, ColorblindPlugin),
  {id: 'zindex', commands: zindex_commands, execute: ZIndexPlugin},
  // ...commandsToHash(no_mouse_days_commands, NoMouseDays),
  {id: 'remove-css', commands: remove_css_commands, execute: RemoveCSSPlugin},
  {id: 'detect-overflows', commands: detect_overflows_commands, execute: DetectOverflows},
  {id: 'loop-through-widths', commands: loop_thru_widths_commands, execute: LoopThruWidths},
  // ...commandsToHash(placeholdifier_commands, PlaceholdifierPlugin),
  {id: 'expand-text', commands: expand_text_commands, execute: ExpandTextPlugin},
  {
    id: 'export',
    commands: export_commands,
    execute: ExportPlugin,
    selectionActions: export_selection_actions,
    active: true,
  },
]

builtInPlugins.forEach(registerPlugin)

export const PluginHints = [
  {command: blank_page_commands[0], description: blank_page_description},
  {command: barrel_roll_commands[0], description: barrel_roll_description},
  // {command: pesticide_commands[0], description: pesticide_description},
  // {command: construct_commands[0], description: construct_description},
  // {command: construct_debug_commands[0], description: construct_debug_description},
  // {command: ct_head_scan_commands[0], description: ct_head_scan_description},
  // {command: wireframe_commands[0], description: wireframe_description},
  // {command: skeleton_commands[0], description: skeleton_description},
  {command: tag_debugger_commands[0], description: tag_debugger_description},
  // {command: revenge_commands[0], description: revenge_description},
  // {command: tota11y_commands[0], description: tota11y_description},
  {command: shuffle_commands[0], description: shuffle_description},
  {command: zindex_commands[0], description: zindex_description},
  // {command: no_mouse_days_commands[0], description: no_mouse_days_description},
  {command: remove_css_commands[0], description: remove_css_description},
  {command: detect_overflows_commands[0], description: detect_overflows_description},
  {command: loop_thru_widths_commands[0], description: loop_thru_widths_description},
  // {command: placeholdifier_commands[0], description: placeholdifier_description},
  {command: expand_text_commands[0], description: expand_text_description},
  // ...colorblind_commands.map(cbc => {
  //   return {
  //     command: cbc, description: `simulate ${cbc}`
  //   }
  // }),
].map(hint => {
  hint.command = `/${hint.command}`
  return hint
})

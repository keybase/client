import * as React from 'react'

export const rootEntryId = 'root'

// Desktop overlay paint order, low to high. An entry is never below the entry it was opened from.
export const tiers = {
  app: 0,
  modal: 1,
  accountReset: 2,
  globalError: 3,
  disconnect: 4,
  outOfDate: 5,
} as const
export type Tier = keyof typeof tiers
// the tiers of app-wide overlays, above every modal
export type GlobalTier = Exclude<Tier, 'app' | 'modal'>

// The overlay (a modal, popup or app-wide overlay) the tree below was rendered in, or the app root.
// Key handlers, hot keys and overlays opened below register under it.
export const OverlayEntryContext = React.createContext(rootEntryId)

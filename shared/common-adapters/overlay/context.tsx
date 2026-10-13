import * as React from 'react'

export const rootEntryId = 'root'

// The overlay (a modal, popup or app-wide overlay) the tree below was rendered in, or the app root.
// Key handlers, hot keys and overlays opened below register under it.
export const OverlayEntryContext = React.createContext(rootEntryId)

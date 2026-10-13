import type * as React from 'react'

export type GlobalTier = 'accountReset' | 'globalError' | 'disconnect' | 'outOfDate'

// App-wide overlays stack in the desktop overlay stack; on mobile they render in place.
export const GlobalOverlay = (p: {tier: GlobalTier; children: React.ReactNode}) => p.children as React.ReactElement

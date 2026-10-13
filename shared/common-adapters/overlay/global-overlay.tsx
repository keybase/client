import type * as React from 'react'
import type {GlobalTier} from './context'

// App-wide overlays stack in the desktop overlay stack; on mobile they render in place.
export const GlobalOverlay = (p: {tier: GlobalTier; children: React.ReactNode}) => p.children as React.ReactElement

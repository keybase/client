import type * as React from 'react'
import {OverlayEntry} from './entry.desktop'
import type {GlobalTier} from './context'

// An app-wide overlay in its fixed tier, above every modal and popup in a lower one, whatever opened
// first. The daemon-disconnect overlay blocks everything under it; the others only paint above it and
// leave it usable.
export const GlobalOverlay = (p: {tier: GlobalTier; children: React.ReactNode}) => {
  const {children, tier} = p
  const blocking = tier === 'disconnect'
  return (
    <OverlayEntry
      acceptsKeys={blocking}
      blocking={blocking}
      kind="global"
      passthrough={!blocking}
      tier={tier}
    >
      {children}
    </OverlayEntry>
  )
}

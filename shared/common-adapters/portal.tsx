import type * as React from 'react'

export const Portal = (p: {children: React.ReactNode; hostName?: string; useFullScreenOverlay?: boolean}) =>
  p.children as React.ReactElement
export const PortalHost = (_p: {name: string}) => null
export const PortalProvider = (p: {children: React.ReactNode}) => p.children as React.ReactElement

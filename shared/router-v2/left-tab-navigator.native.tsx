// Native stub — the left tab navigator is desktop-only (the desktop root layout).
// router.tsx imports this only inside an isMobile === false branch, so it never runs
// on native; the stub lets the base module resolve without pulling the desktop
// implementation (react-dom etc.) into the native bundle. Typed structurally (not via
// the .desktop module) so native tsc doesn't type-check the DOM-using desktop file.
import type * as React from 'react'

type LeftTabNavigator = {
  Navigator: React.ComponentType<{backBehavior?: string; screenOptions?: object; children?: React.ReactNode}>
  Screen: React.ComponentType<{name: string; component: React.ComponentType; key?: string}>
}

export const createLeftTabNavigator = (): LeftTabNavigator => {
  throw new Error('left-tab-navigator is desktop-only')
}

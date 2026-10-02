import * as React from 'react'
import {NavigationRouteContext} from '@react-navigation/core'
import {useRouterState, type NavState} from '@/stores/router'
import type {Immutable} from 'immer'

// A flow a screen owns ends when the screen's route leaves the navigation state: a back, a dismissal,
// clearModals, the root swap of a logout or account switch. Not on an effect cleanup, which StrictMode,
// a screen hidden under others (React Activity) and a hot reload run while the route stays. Not on
// beforeRemove either: a root swap removes routes without it, and it fires for a removal another
// listener then prevents.

export type RouteParams = Immutable<object> | undefined

type Entry = {
  onGone: (lastParams: RouteParams) => void
  params: RouteParams
  // In a root state since registering. A route registered before its first commit reaches the
  // state is not gone until it has been there.
  seen: boolean
  until: Promise<unknown>
}

const entries = new Map<string, Entry>()

const routeParams = (state: Immutable<NavState> | undefined, out = new Map<string, RouteParams>()) => {
  for (const r of state?.routes ?? []) {
    if (r.key) {
      out.set(r.key, r.params)
    }
    routeParams(r.state, out)
  }
  return out
}

const onRootState = (state: Immutable<NavState> | undefined) => {
  // No container (between an account switch's unmount and the new one's first state) is not a
  // removal
  if (!state) return
  const present = routeParams(state)
  for (const [key, entry] of [...entries]) {
    if (present.has(key)) {
      entry.seen = true
      entry.params = present.get(key)
    } else if (entry.seen) {
      entries.delete(key)
      entry.onGone(entry.params)
    }
  }
}

useRouterState.subscribe((s, prev) => {
  if (s.navState !== prev.navState) {
    onRootState(s.navState)
  }
})

// Calls onGone once, with the route's params as last seen, when the route with this key leaves the
// navigation state. Registering again under a key replaces the entry. The entry goes when `until`
// settles: the flow is over and has nothing left to end.
export const registerRouteGone = (
  routeKey: string,
  until: Promise<unknown>,
  onGone: (lastParams: RouteParams) => void
) => {
  const prev = entries.get(routeKey)
  if (prev?.until === until && prev.onGone === onGone) return
  const present = routeParams(useRouterState.getState().navState)
  const entry: Entry = {
    onGone,
    params: present.has(routeKey) ? present.get(routeKey) : prev?.params,
    seen: present.has(routeKey) || !!prev?.seen,
    until,
  }
  entries.set(routeKey, entry)
  const drop = () => {
    if (entries.get(routeKey) === entry) {
      entries.delete(routeKey)
    }
  }
  void until.then(drop, drop)
}

// The key of the route this screen renders, absent outside a navigator (storybook)
export const useRouteKey = () => React.useContext(NavigationRouteContext)?.key

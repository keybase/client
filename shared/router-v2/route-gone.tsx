import * as React from 'react'
import {NavigationRouteContext} from '@react-navigation/core'
import {getNavigator} from '@/constants/navigator'
import logger from '@/logger'
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
  // In a root state since registering, or in the navigator's own state when it registered. A route
  // not yet in either is not gone until it has been there: a state without it can't tell a route
  // not yet committed from one already removed.
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
  if (!state || !entries.size) return
  const present = routeParams(state)
  for (const [key, entry] of [...entries]) {
    if (present.has(key)) {
      entry.seen = true
      entry.params = present.get(key)
    } else if (entry.seen) {
      entries.delete(key)
      // One flow's failure doesn't keep the others from ending
      try {
        entry.onGone(entry.params)
      } catch (error) {
        logger.error(`route gone: ending the flow of ${key} failed`, error)
      }
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
  // The navigator's state is ahead of the router store's copy, which a screen's mount effect runs
  // before: a route that leaves before the copy has it would otherwise never be seen
  const present = routeParams(
    getNavigator().getRootState() as Immutable<NavState> | undefined,
    routeParams(useRouterState.getState().navState)
  )
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

// The routes registered until this wait that have not left the navigation state: the screens of the
// flow it is the end of
export const routesRegisteredUntil = (until: Promise<unknown>) =>
  [...entries].filter(([, entry]) => entry.until === until).map(([key]) => key)

// An onGone for a prompt's screen: declines the prompt in the params the route last had, as a retry
// (a wrong paper key or password) sets the next prompt's id on the same route. Make it once, at
// module level, so registering again is the same entry.
export const promptRouteGone = (decline: (promptId: number) => void) => (params: RouteParams) => {
  const {promptId} = (params ?? {}) as {promptId?: unknown}
  if (typeof promptId === 'number') {
    decline(promptId)
  }
}

// The key of the route this screen renders, absent outside a navigator (storybook)
export const useRouteKey = () => React.useContext(NavigationRouteContext)?.key

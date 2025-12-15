import type * as T from '../types'
import type * as Tabs from '../tabs'
import {createNavigationContainerRef, type NavigationState} from '@react-navigation/core'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import {registerDebugClear} from '@/util/debug'

export const navigationRef = createNavigationContainerRef<KBRootParamList>()

registerDebugClear(() => {
  navigationRef.current = null
})

export type Route = NavigationState<KBRootParamList>['routes'][0]
// still a little paranoid about some things being missing in this type
export type NavState = Partial<Route['state']>

export const getRootState = (): NavState | undefined => {
  if (!navigationRef.isReady()) return
  return navigationRef.getRootState()
}

export const getTab = (navState?: T.Immutable<NavState>): undefined | Tabs.Tab => {
  const s = navState || getRootState()
  const loggedInRoute = s?.routes?.[0]
  if (loggedInRoute?.name === 'loggedIn') {
    // eslint-disable-next-line
    return loggedInRoute.state?.routes?.[loggedInRoute.state.index ?? 0]?.name as Tabs.Tab
  }
  return undefined
}

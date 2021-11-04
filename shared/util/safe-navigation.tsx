import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {useNavigationState} from '@react-navigation/native'

type Path = Array<string | {props?: any; selected?: string}>

type SafeNavigateAppendArg = {path: Path; replace?: boolean}
type SafeNavigationProps = {
  safeNavigateAppendPayload: (arg0: SafeNavigateAppendArg) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
  navKey: string
}
type SafeNavHook = () => SafeNavigationProps

export const useSafeNavigation: SafeNavHook = () => {
  const fromKey = useNavigationState(state => {
    if (!state.routes) {
      return statea.key
    }
    const route = state.routes[state.index]
    if (route.routes) {
      return getActiveKey(route)
    }
    return state.routes[state.index].key
  })
  return React.useMemo(
    () => ({
      navKey: fromKey,
      safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
        RouteTreeGen.createNavigateAppend({fromKey, path, replace}),
      safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey}),
    }),
    [fromKey]
  )
}

import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {getActiveKey} from '../router-v2/util'
import {useNavigationState} from './navigation-hooks'

type Path = Array<string | {props?: any; selected?: string}>

type SafeNavigateAppendArg = {path: Path; replace?: boolean}
type SafeNavigationProps = {
  safeNavigateAppendPayload: (arg0: SafeNavigateAppendArg) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
  navKey: string
}
type SafeNavHook = () => SafeNavigationProps

export const useSafeNavigation: SafeNavHook = () => {
  const state = useNavigationState()
  const fromKey = getActiveKey(state)
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

import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'

type Path = Array<string | {props?: any; selected?: string}>

type SafeNavigateAppendArg = {path: Path; replace?: boolean}
type SafeNavigationProps = {
  safeNavigateAppendPayload: (arg0: SafeNavigateAppendArg) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
  navKey: string
}
type SafeNavHook = () => SafeNavigationProps

export const useSafeNavigation: SafeNavHook = () => {
  const route = Container.useRoute()
  const fromKey = route.key
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

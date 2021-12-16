import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
// import {getVisiblePath} from '../constants/router2'
import {useIsFocused} from '@react-navigation/core'

type Path = Array<string | {props?: any; selected?: string}>

type SafeNavigateAppendArg = {path: Path; replace?: boolean}
// type SafeNavigationProps = {
// safeNavigateAppendPayload: (arg0: SafeNavigateAppendArg) => RouteTreeGen.NavigateAppendPayload
// safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
// navKey: string
// }
// type SafeNavHook = () => SafeNavigationProps

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()

  return React.useMemo(
    () => ({
      safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
        isFocused && RouteTreeGen.createNavigateAppend({path, replace}),
      safeNavigateUpPayload: () => (isFocused ? RouteTreeGen.createNavigateUp({}) : null),
    }),
    [isFocused]
  )
}

// export const useSafeNavigation: SafeNavHook = () => {
// const vis = getVisiblePath()
// const [fromKey, setFromKey] = React.useState(vis[vis.length - 1].key)
// React.useEffect(() => {
// const vis = getVisiblePath()
// setFromKey(vis[vis.length - 1].key)
// console.log('aaa usesafe after useefect', vis[vis.length - 1].key)
// }, [])

// console.log('aaa usesafe after', fromKey)

// return React.useMemo(
// () => ({
// navKey: fromKey,
// safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
// RouteTreeGen.createNavigateAppend({fromKey, path, replace}),
// safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey}),
// }),
// [fromKey]
// )
// }

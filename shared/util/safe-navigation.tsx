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

const useSafeNavigationReal: SafeNavHook = () => {
  const state = useNavigationState()
  const fromKey = getActiveKey(state!)
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

const mockKey = 'mockKey'
const useSafeNavigationStorybook: SafeNavHook = () => ({
  navKey: mockKey,
  safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
    RouteTreeGen.createNavigateAppend({fromKey: mockKey, path, replace}),
  safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey: mockKey}),
})

export const useSafeNavigation: SafeNavHook = __STORYBOOK__
  ? useSafeNavigationStorybook
  : useSafeNavigationReal

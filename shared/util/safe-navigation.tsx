import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {getActiveKey} from '../router-v2/util'
import {useNavigationState} from './navigation-hooks'

type Path = Array<string | {props?: any; selected?: string}>

type SafeNavigationProps = {
  safeNavigateAppendPayload: (arg0: {path: Path; replace?: boolean}) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
  navKey: string
}

export const useSafeNavigation: () => SafeNavigationProps = () => {
  const state = useNavigationState()
  const fromKey = __STORYBOOK__ ? 'mockKey' : getActiveKey(state)
  return React.useMemo(
    () => ({
      navKey: fromKey,
      safeNavigateAppendPayload: ({path, replace}) =>
        RouteTreeGen.createNavigateAppend({fromKey, path, replace}),
      safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey}),
    }),
    [fromKey]
  )
}

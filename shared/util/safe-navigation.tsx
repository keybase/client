import * as React from 'react'
import * as RouterConstants from '../constants/router2'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {useIsFocused} from '@react-navigation/core'
import type {NavigateAppendType} from '../router-v2/route-params'

type SafeNavigateAppendArg = {path: NavigateAppendType; replace?: boolean}

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  return React.useMemo(
    () => ({
      safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
        isFocused ? RouteTreeGen.createNavigateAppend({path, replace}) : RouteTreeGen.createNavigateUpNoop(),
      safeNavigateUp: () => isFocused && navigateUp(),
    }),
    [navigateUp, isFocused]
  )
}

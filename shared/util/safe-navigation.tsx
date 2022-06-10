import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {useIsFocused} from '@react-navigation/core'
import type {NavigateAppendType} from '../router-v2/route-params'

type SafeNavigateAppendArg = {path: NavigateAppendType; replace?: boolean}

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()

  return React.useMemo(
    () => ({
      safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
        isFocused ? RouteTreeGen.createNavigateAppend({path, replace}) : RouteTreeGen.createNavigateUpNoop(),
      safeNavigateUpPayload: () =>
        isFocused ? RouteTreeGen.createNavigateUp({}) : RouteTreeGen.createNavigateUpNoop(),
    }),
    [isFocused]
  )
}

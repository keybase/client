import * as C from '@/constants'
import {useIsFocused} from '@react-navigation/core'
import type {NavigateAppendType} from '@/router-v2/route-params'

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  return {
    safeNavigateAppend: (path: NavigateAppendType, replace?: boolean) =>
      isFocused && navigateAppend(path, replace),
    safeNavigateUp: () => isFocused && navigateUp(),
  }
}

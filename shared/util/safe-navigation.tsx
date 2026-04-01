import * as C from '@/constants'
import {useIsFocused} from '@react-navigation/core'
import type {NavigateAppendArg, RouteKeys} from '@/router-v2/route-params'

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  return {
    safeNavigateAppend: <RouteName extends RouteKeys>(
      path: NavigateAppendArg<RouteName>,
      replace?: boolean
    ) =>
      isFocused && navigateAppend(path, replace),
    safeNavigateUp: () => isFocused && navigateUp(),
  }
}

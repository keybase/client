import * as C from '@/constants'
import {useIsFocused} from '@react-navigation/core'
import type {NoParamRouteKeys, ParamRouteKeys, RootParamList} from '@/router-v2/route-params'

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  function safeNavigateAppend<RouteName extends NoParamRouteKeys>(path: RouteName, replace?: boolean): void
  function safeNavigateAppend<RouteName extends ParamRouteKeys>(
    path: {name: RouteName; params: RootParamList[RouteName]},
    replace?: boolean
  ): void
  function safeNavigateAppend(
    path: NoParamRouteKeys | {name: ParamRouteKeys; params: object | undefined},
    replace?: boolean
  ) {
    return isFocused && navigateAppend(path as never, replace)
  }
  return {
    safeNavigateAppend,
    safeNavigateUp: () => isFocused && navigateUp(),
  }
}

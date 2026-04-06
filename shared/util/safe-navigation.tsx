import * as C from '@/constants'
import {useIsFocused} from '@react-navigation/core'
import type {NavigateAppendType} from '@/router-v2/route-params'

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  return {
    safeNavigateAppend: (path: NavigateAppendType, replace?: boolean) =>
      isFocused && navigateAppend(path as never, replace),
    safeNavigateUp: () => isFocused && navigateUp(),
  }
}

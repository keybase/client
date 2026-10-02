import * as C from '@/constants'
import {useIsFocused} from '@react-navigation/core'
import type {NavigateAppendType} from '@/router-v2/route-params'

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  return {
    safeNavigateAppend: (path: NavigateAppendType, replace?: boolean) =>
      isFocused && C.Router2.navigateAppend(path as never, replace),
    safeNavigateUp: () => isFocused && C.Router2.navigateUp(),
  }
}

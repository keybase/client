import * as C from '@/constants'
import * as React from 'react'
import {useIsFocused} from '@react-navigation/core'
import {useNavigation} from '@react-navigation/native'
import type {NavigateAppendType} from '@/router-v2/route-params'

export const useSafeNavigation = () => {
  const isFocused = useIsFocused()
  return {
    safeNavigateAppend: (path: NavigateAppendType, replace?: boolean) =>
      isFocused && C.Router2.navigateAppend(path as never, replace),
    safeNavigateUp: () => isFocused && C.Router2.navigateUp(),
  }
}

// Runs `onRemove` whenever this screen is about to be removed, whatever removed it.
export const useOnRemove = (onRemove: (actionType: string) => void) => {
  const navigation = useNavigation()
  React.useEffect(() => {
    return navigation.addListener('beforeRemove', e => onRemove(e.data.action.type))
  }, [navigation, onRemove])
}

// Runs `onUserRemove` when the user takes this screen away: back button, hardware back, swipe or a native
// dismissal. beforeRemove also fires when the app removes screens itself with a RESET or a REPLACE (e.g.
// login success unmounting the logged-out stack), and those are not the user leaving. Native back/swipe
// dismissals arrive as REMOVE (native-stack's onDismissed); the app never dispatches REMOVE itself.
export const useOnUserRemove = (onUserRemove: () => void) => {
  useOnRemove(type => {
    if (type === 'POP' || type === 'GO_BACK' || type === 'REMOVE') {
      onUserRemove()
    }
  })
}

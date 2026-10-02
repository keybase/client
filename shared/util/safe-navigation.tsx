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
  const onRemoveEvent = React.useEffectEvent(onRemove)
  React.useEffect(() => {
    return navigation.addListener('beforeRemove', e => onRemoveEvent(e.data.action.type))
  }, [navigation])
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

// Takes this screen away whenever it is focused (on mount, or uncovered later) and `shouldClose` says it has
// nothing left to show. For a screen the app can't remove while another modal covers it: only the top modal
// may be removed on iOS, so it waits there until it is the top again.
export const useCloseWhenFocusedIf = (shouldClose: () => boolean) => {
  const navigation = useNavigation()
  const shouldCloseEvent = React.useEffectEvent(shouldClose)
  React.useEffect(() => {
    const closeIfDone = () => {
      if (navigation.isFocused() && shouldCloseEvent()) {
        navigation.goBack()
      }
    }
    closeIfDone()
    return navigation.addListener('focus', closeIfDone)
  }, [navigation])
}

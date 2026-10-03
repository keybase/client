import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {getVisibleScreen, navigateUp} from '@/constants/router'
import {useRouteKey} from '@/router-v2/route-gone'
import {
  isRecoverPasswordPromptGone,
  isRecoverPasswordPromptOpen,
  registerRecoverPasswordPromptScreen,
} from './flow'

// A prompt screen leaving while its prompt is open would leave the service waiting. A back of the
// visible screen (Android's hardware back, a pop) runs its onBack in its place, as the header back
// does. Any other removal, or a back of a screen with no onBack, declines the prompt once the route
// has left the navigation state, so a removal another listener prevents declines nothing. The flow's
// own navigation comes after it closed the prompt, so it passes.
export const useRecoverPromptBack = (promptId: number, onBack?: () => void) => {
  // Absent outside a navigator (storybook)
  const navigation = React.useContext(NavigationContext)
  const back = React.useEffectEvent(() => onBack?.())
  const hasBack = !!onBack

  React.useEffect(() => {
    if (!navigation || !hasBack) return
    return navigation.addListener('beforeRemove', e => {
      const {type} = e.data.action
      if (!(type === 'POP' || type === 'GO_BACK') || !isRecoverPasswordPromptOpen(promptId)) return
      e.preventDefault()
      back()
    })
  }, [navigation, promptId, hasBack])

  // Registered once mounted and again on a retry's new prompt; never undone on cleanup, as the entry
  // ends with the run
  const routeKey = useRouteKey()
  React.useEffect(() => {
    if (routeKey) {
      registerRecoverPasswordPromptScreen(routeKey, promptId)
    }
  }, [routeKey, promptId])
}

// A deferred push can land after its prompt settled, leaving the screen nothing to answer. Effects
// also re-run after the screen answered (a screen unfreezing, a hot reload), when it must stay. A
// covered screen stays: removing a covered modal crashes iOS.
export const useRecoverPromptSelfClose = (promptId: number, routeName: string) => {
  React.useEffect(() => {
    if (!isRecoverPasswordPromptGone(promptId)) return
    const visible = getVisibleScreen(true)
    if (
      visible?.name === routeName &&
      (visible.params as {promptId?: number} | undefined)?.promptId === promptId
    ) {
      navigateUp()
    }
  }, [promptId, routeName])
}

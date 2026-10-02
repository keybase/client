import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {getVisibleScreen, navigateUp} from '@/constants/router'
import {declineRecoverPasswordPrompt, isRecoverPasswordPromptGone, isRecoverPasswordPromptOpen} from './flow'

// A prompt screen leaving while its prompt is open would leave the service waiting. A back (Android's
// hardware back, a pop) runs the screen's onBack in its place, as the header back does; with no onBack
// the prompt is declined and the screen goes. A native dismissal (REMOVE) has already happened, so it
// only declines. The flow's own navigation comes after it closed the prompt, so it passes.
export const useRecoverPromptBack = (promptId: number, onBack?: () => void) => {
  // Absent outside a navigator (storybook)
  const navigation = React.useContext(NavigationContext)
  const back = React.useEffectEvent(() => onBack?.())
  const hasBack = !!onBack

  React.useEffect(() => {
    if (!navigation) return
    return navigation.addListener('beforeRemove', e => {
      const {type} = e.data.action
      if (!(type === 'POP' || type === 'GO_BACK' || type === 'REMOVE')) return
      if (!isRecoverPasswordPromptOpen(promptId)) return
      if (type !== 'REMOVE' && hasBack) {
        e.preventDefault()
        back()
      } else {
        declineRecoverPasswordPrompt(promptId)
      }
    })
  }, [navigation, promptId, hasBack])
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

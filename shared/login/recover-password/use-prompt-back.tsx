import * as React from 'react'
import {getVisibleScreen, navigateUp} from '@/constants/router'
import {usePromptRouteBack} from '@/router-v2/use-prompt-route-back'
import {
  declineRecoverPasswordPrompt,
  isRecoverPasswordPromptGone,
  isRecoverPasswordPromptOpen,
  recoverPasswordRunEnded,
} from './flow'

// A recover prompt screen's back: see usePromptRouteBack
export const useRecoverPromptBack = (promptId: number, onBack?: () => void) =>
  usePromptRouteBack({
    decline: declineRecoverPasswordPrompt,
    isOpen: isRecoverPasswordPromptOpen,
    onBack,
    promptId,
    until: recoverPasswordRunEnded,
  })

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

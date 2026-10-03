import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {getVisibleScreen, navigateUp} from '@/constants/router'
import {useRouteKey} from '@/router-v2/route-gone'
import {
  isRecoverPasswordPromptGone,
  isRecoverPasswordPromptOpen,
  registerRecoverPasswordScreen,
} from './flow'

// Registers the screen's route with the run that showed it (see registerRecoverPasswordScreen), once
// mounted and again on a retry's new prompt. Never undone on cleanup: the entry ends with the run.
export const useRecoverRunScreen = (owner: {promptId: number} | {runId: number | undefined}) => {
  const routeKey = useRouteKey()
  const promptId = 'promptId' in owner ? owner.promptId : undefined
  const runId = 'runId' in owner ? owner.runId : undefined
  React.useEffect(() => {
    if (!routeKey) return
    if (promptId !== undefined) {
      registerRecoverPasswordScreen(routeKey, {promptId})
    } else if (runId !== undefined) {
      registerRecoverPasswordScreen(routeKey, {runId})
    }
  }, [routeKey, promptId, runId])
}

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

  useRecoverRunScreen({promptId})
}

// A deferred push can land after its prompt settled, or the run can end while another modal covers
// the screen, leaving it nothing to answer. It closes once it is the top screen: on mount and whenever
// it is focused again. A covered screen stays: removing a covered modal crashes iOS. Effects also re-run
// after the screen answered (a screen unfreezing, a hot reload), when it must stay while its run goes on.
export const useRecoverPromptSelfClose = (promptId: number, routeName: string) => {
  // Absent outside a navigator (storybook)
  const navigation = React.useContext(NavigationContext)
  React.useEffect(() => {
    const closeIfGone = () => {
      if (!isRecoverPasswordPromptGone(promptId)) return
      const visible = getVisibleScreen(true)
      if (
        visible?.name === routeName &&
        (visible.params as {promptId?: number} | undefined)?.promptId === promptId
      ) {
        navigateUp()
      }
    }
    closeIfGone()
    return navigation?.addListener('focus', closeIfGone)
  }, [navigation, promptId, routeName])
}

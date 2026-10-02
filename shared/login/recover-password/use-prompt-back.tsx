import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {isRecoverPasswordPromptOpen, refuseRecoverPasswordPrompt} from './flow'

// A prompt screen leaving while its prompt is open would leave the service waiting. A back (Android's
// hardware back, a pop) runs the screen's onBack in its place, as the header back does; with no onBack
// the prompt is refused and the screen goes. A native dismissal (REMOVE) has already happened, so it
// only refuses. The flow's own navigation comes after it closed the prompt, so it passes.
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
        refuseRecoverPasswordPrompt(promptId)
      }
    })
  }, [navigation, promptId, hasBack])
}

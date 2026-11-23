import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {cancelRecoverPassword} from './flow'

// Go waits on the prompt a screen shows, so the user taking it away must answer it. Only a back press,
// Android back or a native dismissal (DISMISS, from native-stack's onDismissed) is the user's: the
// flow's next screen replacing this one, or the logged-in root taking over, is not an answer.
export const useCancelRecoverPasswordOnLeave = () => {
  // Absent outside a navigator (storybook).
  const navigation = React.useContext(NavigationContext)
  React.useEffect(() => {
    if (!navigation) return
    return navigation.addListener('beforeRemove', e => {
      const {type} = e.data.action
      if (type === 'POP' || type === 'GO_BACK' || type === 'DISMISS') {
        cancelRecoverPassword()
      }
    })
  }, [navigation])
}

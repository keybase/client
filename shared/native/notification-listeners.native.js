// @flow
import shared from './notification-listeners.shared'
import RNPN from 'react-native-push-notification'

import type {Dispatch} from '../constants/types/flux'
import type {incomingCallMapType} from '../constants/types/flow-types'

// TODO(mm) Move these to their own actions
export default function(dispatch: Dispatch, getState: () => Object, notify: any): incomingCallMapType {
  const fromShared = shared(dispatch, getState, notify)
  return {
    ...fromShared,
    'keybase.1.NotifyBadges.badgeState': ({badgeState}) => {
      const sharedBadgeState = fromShared['keybase.1.NotifyBadges.badgeState']
      sharedBadgeState({badgeState})

      const count = (badgeState.conversations || []).reduce((total, c) => total + c.UnreadMessages, 0)

      if (count !== -1) {
        RNPN.setApplicationIconBadgeNumber(count)
        if (count === 0) {
          RNPN.cancelAllLocalNotifications()
        }
      }
    },
  }
}

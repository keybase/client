// @flow
import shared from './notification-listeners.shared'
import RNPN from 'react-native-push-notification'
import * as RPCTypes from '../constants/types/rpc-gen'

import type {Dispatch} from '../constants/types/flux'
import type {IncomingCallMapType} from '../constants/types/rpc-gen'

// TODO(mm) Move these to their own actions
export default function(dispatch: Dispatch, getState: () => Object, notify: any): IncomingCallMapType {
  const fromShared: IncomingCallMapType = shared(dispatch, getState, notify)
  const handlers: IncomingCallMapType = {
    'keybase.1.NotifyBadges.badgeState': ({badgeState}) => {
      const sharedBadgeState = fromShared['keybase.1.NotifyBadges.badgeState']
      if (sharedBadgeState) {
        sharedBadgeState({badgeState})
      }

      const count = (badgeState.conversations || []).reduce(
        (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${RPCTypes.commonDeviceType.mobile}`] : total),
        0
      )

      RNPN.setApplicationIconBadgeNumber(count)
      if (count === 0) {
        RNPN.cancelAllLocalNotifications()
      }
    },
  }

  // $FlowIssue doesnt' like spreading exact types
  const combined: IncomingCallMapType = {
    ...fromShared,
    ...handlers,
  }

  return combined
}

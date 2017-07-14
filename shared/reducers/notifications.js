// @flow
import * as Constants from '../constants/notifications'
import * as CommonConstants from '../constants/common'
import {chatTab, folderTab} from '../constants/tabs'
import * as RPCTypes from '../constants/types/flow-types'
import {isMobile} from '../constants/platform'

const initialState: Constants.State = new Constants.StateRecord()

const _updateWidgetBadge = (s: Constants.State): Constants.State => {
  let widgetBadge = 'regular'
  // $FlowIssue getIn
  if (s.getIn(['keyState', 'kbfsUploading'])) {
    widgetBadge = 'uploading'
  } else if (s.desktopAppBadgeCount) {
    widgetBadge = 'badged'
  }

  return s.set('widgetBadge', widgetBadge)
}

export default function(state: Constants.State = initialState, action: Constants.Actions): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState
    case 'notifications:receivedBadgeState': {
      const {conversations, newTlfs, rekeysNeeded} = action.payload.badgeState

      const deviceType = isMobile ? RPCTypes.CommonDeviceType.mobile : RPCTypes.CommonDeviceType.desktop
      const totalMessages = (conversations || [])
        .reduce((total, c) => (c.badgeCounts ? total + c.badgeCounts[`${deviceType}`] : total), 0)

      const navBadges = state.get('navBadges').withMutations(n => {
        n.set(chatTab, totalMessages)
        n.set(folderTab, newTlfs + rekeysNeeded)
      })
      // $FlowIssue withMutations
      let newState = state.withMutations(s => {
        s.set('navBadges', navBadges)
        s.set('desktopAppBadgeCount', navBadges.reduce((total, val) => total + val, 0))
        s.set('mobileAppBadgeCount', totalMessages)
      })

      newState = _updateWidgetBadge(newState)
      return newState
    }
    case 'notifications:badgeApp':
      const badgeAction: Constants.BadgeAppAction = action

      // $FlowIssue update
      let newState = state.update('keyState', ks => ks.set(badgeAction.payload.key, badgeAction.payload.on))
      newState = _updateWidgetBadge(newState)
      return newState
    default:
      return state
  }
}

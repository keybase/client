// @flow
import * as Constants from '../constants/notifications'
import * as CommonConstants from '../constants/common'
import {chatTab, folderTab} from '../constants/tabs'

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

export default function (state: Constants.State = initialState, action: Constants.Actions): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState
    case 'notifications:receivedBadgeState': {
      const {conversations, newTlfs, rekeysNeeded} = action.payload.badgeState

      const navBadges = state.get('navBadges').withMutations(n => {
        const totalMessages = (conversations || []).reduce((total, c) => total + c.UnreadMessages, 0)
        n.set(chatTab, totalMessages)
        n.set(folderTab, newTlfs + rekeysNeeded)
      })

      // $FlowIssue withMutations
      let newState = state.withMutations(s => {
        s.set('navBadges', navBadges)
        s.set('desktopAppBadgeCount', navBadges.reduce((total, val) => total + val, 0))
        s.set('mobileAppBadgeCount', navBadges.get(chatTab, 0))
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

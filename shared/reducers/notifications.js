// @flow
import * as Types from '../constants/types/notifications'
import * as Constants from '../constants/notifications'
import * as NotificationsGen from '../actions/notifications-gen'
import * as Tabs from '../constants/tabs'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as I from 'immutable'
import {isMobile} from '../constants/platform'
import flags from '../util/feature-flags'

const initialState: Types.State = Constants.makeState()

const _updateWidgetBadge = (s: Types.State): Types.State => {
  let widgetBadge = 'regular'
  if (s.getIn(['keyState', 'kbfsUploading'])) {
    widgetBadge = 'uploading'
  } else if (s.desktopAppBadgeCount) {
    widgetBadge = 'badged'
  }

  return s.set('widgetBadge', widgetBadge)
}

export default function(state: Types.State = initialState, action: NotificationsGen.Actions): Types.State {
  switch (action.type) {
    case NotificationsGen.resetStore:
      return initialState
    case NotificationsGen.receivedBadgeState: {
      const {
        homeTodoItems,
        conversations,
        newTlfs,
        rekeysNeeded,
        newGitRepoGlobalUniqueIDs,
        newTeamNames,
        newTeamAccessRequests,
        teamsWithResetUsers,
      } = action.payload.badgeState

      // teamsWithResetUsers contains duplicate usernames sometimes
      // reduce to deduplicate them
      const res = {}
      const teamResetUsers = (teamsWithResetUsers || []).reduce((count, entry) => {
        if (!res[entry.teamname]) {
          res[entry.teamname] = I.Set()
        }
        if (!res[entry.teamname].contains(entry.username)) {
          res[entry.teamname] = res[entry.teamname].add(entry.username)
          return count + 1
        }
        return count
      }, 0)

      const deviceType = isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop
      const totalMessages = (conversations || []).reduce(
        (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${deviceType}`] : total),
        0
      )
      const newGit = (newGitRepoGlobalUniqueIDs || []).length
      const newTeams = (newTeamNames || []).length + (newTeamAccessRequests || []).length + teamResetUsers

      const navBadges = state.get('navBadges').withMutations(n => {
        n.set(Tabs.chatTab, totalMessages)
        n.set(Tabs.folderTab, newTlfs + rekeysNeeded)
        n.set(Tabs.gitTab, newGit)
        n.set(Tabs.teamsTab, newTeams)
        n.set(Tabs.peopleTab, flags.newPeopleTab ? homeTodoItems : 0)
      })
      let newState = state.withMutations(s => {
        s.set('navBadges', navBadges)
        s.set('desktopAppBadgeCount', navBadges.reduce((total, val) => total + val, 0))
        s.set('mobileAppBadgeCount', totalMessages)
      })

      newState = _updateWidgetBadge(newState)
      return newState
    }
    case NotificationsGen.badgeApp:
      const {key, on} = action.payload
      let newState = state.update('keyState', ks => ks.set(key, on))
      newState = _updateWidgetBadge(newState)
      return newState
    // Saga only actions
    case NotificationsGen.listenForKBFSNotifications:
    case NotificationsGen.listenForNotifications:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

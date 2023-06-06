import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const {dispatchSetBadges} = Constants.useGitState.getState()
  dispatchSetBadges(new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs))
}

const resetStore = () => {
  const {dispatchReset} = Constants.useGitState.getState()
  dispatchReset()
}

const initGit = () => {
  Container.listenAction(ConfigGen.resetStore, resetStore)
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
}

export default initGit

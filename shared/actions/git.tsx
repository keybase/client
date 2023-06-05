import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const dispatchSetBadges = Constants.useGitState.getState().dispatchSetBadges
  dispatchSetBadges(new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs))
}

const initGit = () => {
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
}

export default initGit

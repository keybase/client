import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'

const initGit = () => {
  Container.listenAction(ConfigGen.resetStore, () => {
    const {dispatchReset} = Constants.useGitState.getState()
    dispatchReset()
  })
  Container.listenAction(NotificationsGen.receivedBadgeState, (_, action) => {
    const {dispatchSetBadges} = Constants.useGitState.getState()
    dispatchSetBadges(new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs))
  })
}

export default initGit

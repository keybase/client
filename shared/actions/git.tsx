import * as Constants from '../constants/git'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'

const initGit = () => {
  Container.listenAction(ConfigGen.resetStore, () => {
    const {reset} = Constants.useGitState.getState().dispatch
    reset()
  })
  Container.listenAction(NotificationsGen.receivedBadgeState, (_, action) => {
    const {setBadges} = Constants.useGitState.getState().dispatch
    setBadges(new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs))
  })
}

export default initGit

import * as Constants from '../constants/git'
import * as ConfigConstants from '../constants/config'

const initGit = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    const {setBadges} = Constants.useGitState.getState().dispatch
    setBadges(new Set(s.badgeState?.newGitRepoGlobalUniqueIDs))
  })
}

export default initGit

import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/teams'
import * as RouterConstants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/teams'
import {mapGetEnsureValue} from '../util/map'

const initTeams = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loadOnStartPhase === old.loadOnStartPhase) return
    switch (s.loadOnStartPhase) {
      case 'startupOrReloginButNotInARush':
        Constants.useState.getState().dispatch.getTeams()
        Constants.useState.getState().dispatch.refreshTeamRoleMap()
        break
      default:
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.gregorPushState === old.gregorPushState) return
    Constants.useState.getState().dispatch.onGregorPushState(s.gregorPushState)
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.gregorReachable === old.gregorReachable) return
    Constants.useState.getState().dispatch.eagerLoadTeams()
  })

  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    if (
      prev &&
      RouterConstants.getTab(prev) === Tabs.teamsTab &&
      next &&
      RouterConstants.getTab(next) !== Tabs.teamsTab
    ) {
      Constants.useState.getState().dispatch.clearNavBadges()
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    const loggedIn = ConfigConstants.useConfigState.getState().loggedIn
    if (!loggedIn) {
      // Don't make any calls we don't have permission to.
      return
    }
    const {badgeState} = s
    if (!badgeState) return
    const deletedTeams = badgeState.deletedTeams || []
    const newTeams = new Set<string>(badgeState.newTeams || [])
    const teamsWithResetUsers: Array<RPCTypes.TeamMemberOutReset> = badgeState.teamsWithResetUsers || []
    const teamsWithResetUsersMap = new Map<Types.TeamID, Set<string>>()
    teamsWithResetUsers.forEach(entry => {
      const existing = mapGetEnsureValue(teamsWithResetUsersMap, entry.teamID, new Set())
      existing.add(entry.username)
    })

    // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
    Constants.useState.getState().dispatch.setNewTeamInfo(deletedTeams, newTeams, teamsWithResetUsersMap)
  })
}

export default initTeams

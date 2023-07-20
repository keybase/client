import * as ConfigConstants from '../constants/config'
import * as Constants from '../constants/teams'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as RouterConstants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
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

  Container.listenAction(EngineGen.keybase1NotifyTeamTeamRoleMapChanged, (_, action) => {
    const {newVersion} = action.payload.params
    const loadedVersion = Constants.useState.getState().teamRoleMap.loadedVersion
    logger.info(`Got teamRoleMapChanged with version ${newVersion}, loadedVersion is ${loadedVersion}`)
    if (loadedVersion >= newVersion) {
      return
    }
    Constants.useState.getState().dispatch.refreshTeamRoleMap()
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.gregorPushState === old.gregorPushState) return
    Constants.useState.getState().dispatch.onGregorPushState(s.gregorPushState)
  })
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamChangedByID, (_, action) => {
    Constants.useState.getState().dispatch.teamChangedByID(action.payload.params)
  })
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamRoleMapChanged, (_, action) => {
    Constants.useState.getState().dispatch.setTeamRoleMapLatestKnownVersion(action.payload.params.newVersion)
  })

  Container.listenAction(
    [EngineGen.keybase1NotifyTeamTeamDeleted, EngineGen.keybase1NotifyTeamTeamExit],
    () => {
      if (RouterConstants.getTab()) {
        RouterConstants.useState.getState().dispatch.navUpToScreen('teamsRoot')
      }
    }
  )

  const eagerLoadTeams = () => {
    if (Constants.useState.getState().teamMetaSubscribeCount > 0) {
      logger.info('eagerly reloading')
      Constants.useState.getState().dispatch.getTeams()
    } else {
      logger.info('skipping')
    }
  }
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.gregorReachable === old.gregorReachable) return
    eagerLoadTeams()
  })

  Container.listenAction(EngineGen.keybase1NotifyTeamTeamMetadataUpdate, () => {
    eagerLoadTeams()
  })

  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
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

  Container.listenAction(EngineGen.chat1NotifyChatChatWelcomeMessageLoaded, (_, action) => {
    const {teamID, message} = action.payload.params
    Constants.useState.getState().dispatch.loadedWelcomeMessage(teamID, message)
  })

  Container.listenAction(EngineGen.keybase1NotifyTeamTeamMetadataUpdate, () => {
    Constants.useState.getState().dispatch.resetTeamMetaStale()
  })

  Container.listenAction(EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial, (_, action) => {
    const {membership} = action.payload.params
    Constants.useState.getState().dispatch.notifyTreeMembershipsPartial(membership)
  })

  Container.listenAction(EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone, (_, action) => {
    const {result} = action.payload.params
    Constants.useState.getState().dispatch.notifyTreeMembershipsDone(result)
  })
}

export default initTeams

import * as ConfigConstants from '../constants/config'
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/teams'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as GregorGen from './gregor-gen'
import * as NotificationsGen from './notifications-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/teams'
import {mapGetEnsureValue} from '../util/map'

const initTeams = () => {
  Container.listenAction(ConfigGen.loadOnStart, (_, action) => {
    if (action.payload.phase !== 'startupOrReloginButNotInARush') {
      return
    }
    Constants.useState.getState().dispatch.getTeams()
  })

  Container.listenAction(ConfigGen.loadOnStart, () => {
    Constants.useState.getState().dispatch.refreshTeamRoleMap()
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

  Container.listenAction(GregorGen.pushState, (_, action) => {
    Constants.useState.getState().dispatch.onGregorPushState(action.payload.state)
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
      return Router2Constants.getTab() ? RouteTreeGen.createNavUpToScreen({name: 'teamsRoot'}) : false
    }
  )

  Container.listenAction([EngineGen.keybase1NotifyTeamTeamMetadataUpdate, GregorGen.updateReachable], () => {
    if (Constants.useState.getState().teamMetaSubscribeCount > 0) {
      logger.info('eagerly reloading')
      Constants.useState.getState().dispatch.getTeams()
    } else {
      logger.info('skipping')
    }
  })

  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    if (
      prev &&
      Router2Constants.getTab(prev) === Tabs.teamsTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.teamsTab
    ) {
      Constants.useState.getState().dispatch.clearNavBadges()
    }
  })

  Container.listenAction(NotificationsGen.receivedBadgeState, (_, action) => {
    const loggedIn = ConfigConstants.useConfigState.getState().loggedIn
    if (!loggedIn) {
      // Don't make any calls we don't have permission to.
      return
    }
    const {badgeState} = action.payload
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

/// TODO the relationships here are often inverted. we want to clear actions when a bunch of actions happen
// not have every handler clear it themselves. this reduces the number of actionChains
import * as EngineGen from './engine-gen-gen'
import * as TeamBuildingGen from './team-building-gen'
import * as TeamsGen from './teams-gen'
import type * as Types from '../constants/types/teams'
import * as Constants from '../constants/teams'
import * as ConfigConstants from '../constants/config'
import * as ChatTypes from '../constants/types/chat2'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as RouteTreeGen from './route-tree-gen'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as GregorConstants from '../constants/gregor'
import * as Router2Constants from '../constants/router2'
import {commonListenActions, filterForNs} from './team-building'
import {RPCError} from '../util/errors'
import * as Container from '../util/container'
import {mapGetEnsureValue} from '../util/map'
import logger from '../logger'

const teamDeletedOrExit = () => {
  if (Router2Constants.getTab() == Tabs.teamsTab) {
    return RouteTreeGen.createNavUpToScreen({name: 'teamsRoot'})
  }
  return false
}

const deleteChannelConfirmed = async (_: unknown, action: TeamsGen.DeleteChannelConfirmedPayload) => {
  const {teamID, conversationIDKey} = action.payload
  // channelName is only needed for confirmation, so since we handle
  // confirmation ourselves we don't need to plumb it through.
  await RPCChatTypes.localDeleteConversationLocalRpcPromise(
    {
      channelName: '',
      confirmed: true,
      convID: ChatTypes.keyToConversationID(conversationIDKey),
    },
    Constants.teamWaitingKey(teamID)
  )

  Constants.useState.getState().dispatch.loadTeamChannelList(teamID)
}

const deleteMultiChannelsConfirmed = async (
  _: unknown,
  action: TeamsGen.DeleteMultiChannelsConfirmedPayload
) => {
  const {teamID, channels} = action.payload

  for (const conversationIDKey of channels) {
    await RPCChatTypes.localDeleteConversationLocalRpcPromise(
      {
        channelName: '',
        confirmed: true,
        convID: ChatTypes.keyToConversationID(conversationIDKey),
      },
      Constants.deleteChannelWaitingKey(teamID)
    )
  }

  Constants.useState.getState().dispatch.loadTeamChannelList(teamID)
}

const gregorPushState = (_: unknown, action: GregorGen.PushStatePayload) => {
  const actions: Array<Container.TypedActions> = []
  const items = action.payload.state
  let sawChatBanner = false
  let sawSubteamsBanner = false
  let chosenChannels: undefined | (typeof items)[0]
  const newTeamRequests = new Map<Types.TeamID, Set<string>>()
  items.forEach(i => {
    if (i.item.category === 'sawChatBanner') {
      sawChatBanner = true
    }
    if (i.item.category === 'sawSubteamsBanner') {
      sawSubteamsBanner = true
    }
    if (i.item.category === Constants.chosenChannelsGregorKey) {
      chosenChannels = i
    }
    if (i.item.category.startsWith(Constants.newRequestsGregorPrefix)) {
      const body = GregorConstants.bodyToJSON(i.item.body)
      if (body) {
        const request: {id: Types.TeamID; username: string} = body
        const requests = mapGetEnsureValue(newTeamRequests, request.id, new Set())
        requests.add(request.username)
      }
    }
  })

  if (sawChatBanner) {
    Constants.useState.getState().dispatch.setTeamSawChatBanner()
  }

  if (sawSubteamsBanner) {
    Constants.useState.getState().dispatch.setTeamSawSubteamsBanner()
  }

  Constants.useState.getState().dispatch.setNewTeamRequests(newTeamRequests)

  const teamsWithChosenChannels = new Set<Types.Teamname>(
    GregorConstants.bodyToJSON(chosenChannels?.item.body)
  )

  Constants.useState.getState().dispatch.setTeamsWithChosenChannels(teamsWithChosenChannels)
  return actions
}

const renameTeam = async (_: unknown, action: TeamsGen.RenameTeamPayload) => {
  const {newName: _newName, oldName} = action.payload
  const prevName = {parts: oldName.split('.')}
  const newName = {parts: _newName.split('.')}
  try {
    await RPCTypes.teamsTeamRenameRpcPromise({newName, prevName}, Constants.teamRenameWaitingKey)
  } catch (_) {
    // err displayed from waiting store in component
  }
}

function addThemToTeamFromTeamBuilder(
  state: Container.TypedState,
  {payload: {teamID}}: TeamBuildingGen.FinishTeamBuildingPayload
) {
  if (!teamID) {
    logger.error("Trying to add them to a team, but I don't know what the teamID is.")
    return
  }
  Constants.useState
    .getState()
    .dispatch.addMembersWizardPushMembers(
      [...state.teams.teamBuilding.teamSoFar].map(user => ({assertion: user.id, role: 'writer'}))
    )
  return TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'})
}

async function showTeamByName(_: unknown, action: TeamsGen.ShowTeamByNamePayload) {
  const {teamname, initialTab, addMembers, join} = action.payload
  let teamID: string
  try {
    teamID = await RPCTypes.teamsGetTeamIDRpcPromise({teamName: teamname})
  } catch (err) {
    logger.info(`team="${teamname}" cannot be loaded:`, err)
    // navigate to team page for team we're not in
    logger.info(`showing external team page, join=${join}`)
    return [
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamExternalTeam'}]}),
      ...(join
        ? [
            RouteTreeGen.createNavigateAppend({
              path: [
                {
                  props: {initialTeamname: teamname},
                  selected: 'teamJoinTeamDialog',
                },
              ],
            }),
          ]
        : []),
    ]
  }

  if (addMembers) {
    // Check if we have the right role to be adding members, otherwise don't
    // show the team builder.
    try {
      // Get (hopefully fresh) role map. The app might have just started so it's
      // not enough to just look in the react store.
      const map = await RPCTypes.teamsGetTeamRoleMapRpcPromise()
      const role = map.teams[teamID]?.role || map.teams[teamID]?.implicitRole
      if (role !== RPCTypes.TeamRole.admin && role !== RPCTypes.TeamRole.owner) {
        logger.info(`ignoring team="${teamname}" with addMember, user is not an admin but role=${role}`)
        return null
      }
    } catch (err) {
      logger.info(`team="${teamname}" failed to check if user is an admin:`, err)
      return null
    }
  }

  return [
    RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab}),
    RouteTreeGen.createNavigateAppend({
      path: [{props: {initialTab, teamID}, selected: 'team'}],
    }),
    ...(addMembers
      ? [
          RouteTreeGen.createNavigateAppend({
            path: [{props: {namespace: 'teams', teamID, title: ''}, selected: 'teamsTeamBuilder'}],
          }),
        ]
      : []),
  ]
}

// See protocol/avdl/keybase1/teams.avdl:loadTeamTreeAsync for a description of this RPC.
const loadTeamTree = async (_: unknown, action: TeamsGen.LoadTeamTreePayload) => {
  await RPCTypes.teamsLoadTeamTreeMembershipsAsyncRpcPromise(action.payload)
}

const manageChatChannels = (_: unknown, action: TeamsGen.ManageChatChannelsPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {teamID: action.payload.teamID},
        selected: 'teamAddToChannels',
      },
    ],
  })

const teamSeen = async (_: unknown, action: TeamsGen.TeamSeenPayload) => {
  const {teamID} = action.payload
  try {
    await RPCTypes.gregorDismissCategoryRpcPromise({category: Constants.newRequestsGregorKey(teamID)})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(error.message)
    }
  }
}

const initTeams = () => {
  Container.listenAction(ConfigGen.loadOnStart, (_, action) => {
    if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
      return
    }
    Constants.useState.getState().dispatch.getTeams()
  })
  Container.listenAction(
    [ConfigGen.bootstrapStatusLoaded, EngineGen.keybase1NotifyTeamTeamRoleMapChanged],
    (_, action) => {
      if (action.type === EngineGen.keybase1NotifyTeamTeamRoleMapChanged) {
        const {newVersion} = action.payload.params
        const loadedVersion = Constants.useState.getState().teamRoleMap.loadedVersion
        logger.info(`Got teamRoleMapChanged with version ${newVersion}, loadedVersion is ${loadedVersion}`)
        if (loadedVersion >= newVersion) {
          return
        }
      }
      Constants.useState.getState().dispatch.refreshTeamRoleMap()
    }
  )

  Container.listenAction(TeamsGen.deleteChannelConfirmed, deleteChannelConfirmed)
  Container.listenAction(TeamsGen.deleteMultiChannelsConfirmed, deleteMultiChannelsConfirmed)
  Container.listenAction(TeamsGen.renameTeam, renameTeam)
  Container.listenAction(TeamsGen.manageChatChannels, manageChatChannels)
  Container.listenAction(GregorGen.pushState, gregorPushState)
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamChangedByID, (_, action) => {
    Constants.useState.getState().dispatch.teamChangedByID(action.payload.params)
  })
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamRoleMapChanged, (_, action) => {
    Constants.useState.getState().dispatch.setTeamRoleMapLatestKnownVersion(action.payload.params.newVersion)
  })

  Container.listenAction(
    [EngineGen.keybase1NotifyTeamTeamDeleted, EngineGen.keybase1NotifyTeamTeamExit],
    teamDeletedOrExit
  )

  Container.listenAction([EngineGen.keybase1NotifyTeamTeamMetadataUpdate, GregorGen.updateReachable], () => {
    if (Constants.useState.getState().teamMetaSubscribeCount > 0) {
      logger.info('eagerly reloading')
      Constants.useState.getState().dispatch.getTeams()
    } else {
      logger.info('skipping')
    }
  })

  Container.listenAction(TeamsGen.showTeamByName, showTeamByName)

  Container.listenAction(TeamsGen.loadTeamTree, loadTeamTree)

  Container.listenAction(TeamsGen.teamSeen, teamSeen)
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

  // Hook up the team building sub saga
  commonListenActions('teams')
  Container.listenAction(
    TeamBuildingGen.finishTeamBuilding,
    filterForNs('teams', addThemToTeamFromTeamBuilder)
  )

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

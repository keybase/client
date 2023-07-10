/// TODO the relationships here are often inverted. we want to clear actions when a bunch of actions happen
// not have every handler clear it themselves. this reduces the number of actionChains
import * as EngineGen from './engine-gen-gen'
import * as TeamBuildingGen from './team-building-gen'
import * as TeamsGen from './teams-gen'
import * as Types from '../constants/types/teams'
import * as Constants from '../constants/teams'
import * as ConfigConstants from '../constants/config'
import * as ProfileConstants from '../constants/profile'
import * as ChatTypes from '../constants/types/chat2'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as RouteTreeGen from './route-tree-gen'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'
import * as Chat2Gen from './chat2-gen'
import * as GregorGen from './gregor-gen'
import * as GregorConstants from '../constants/gregor'
import * as Router2Constants from '../constants/router2'
import {commonListenActions, filterForNs} from './team-building'
import {uploadAvatarWaitingKey} from '../constants/profile'
import openSMS from '../util/sms'
import {RPCError, logError} from '../util/errors'
import * as Container from '../util/container'
import {mapGetEnsureValue} from '../util/map'
import logger from '../logger'

const getTeamProfileAddList = async (_: unknown, action: TeamsGen.GetTeamProfileAddListPayload) => {
  const r = await RPCTypes.teamsTeamProfileAddListRpcPromise(
    {username: action.payload.username},
    Constants.teamProfileAddListWaitingKey
  )
  const res = (r || []).reduce<Array<RPCTypes.TeamProfileAddEntry>>((arr, t) => {
    t && arr.push(t)
    return arr
  }, [])
  const teamlist = res.map(team => ({
    disabledReason: team.disabledReason,
    open: team.open,
    teamName: team.teamName.parts ? team.teamName.parts.join('.') : '',
  }))
  teamlist.sort((a, b) => a.teamName.localeCompare(b.teamName))
  return TeamsGen.createSetTeamProfileAddList({teamlist})
}

const deleteTeam = async (
  _: Container.TypedState,
  action: TeamsGen.DeleteTeamPayload,
  listenerApi: Container.ListenerApi
) => {
  try {
    await RPCTypes.teamsTeamDeleteRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.teamsUi.confirmRootTeamDelete': (_, response) => response.result(true),
          'keybase.1.teamsUi.confirmSubteamDelete': (_, response) => response.result(true),
        },
        incomingCallMap: {},
        params: {teamID: action.payload.teamID},
        waitingKey: Constants.deleteTeamWaitingKey(action.payload.teamID),
      },
      listenerApi
    )
  } catch (error) {
    if (error instanceof RPCError) {
      // handled through waiting store
      logger.warn('error:', error.message)
    }
  }
}
const leaveTeam = async (_: unknown, action: TeamsGen.LeaveTeamPayload) => {
  const {context, teamname, permanent} = action.payload
  logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
  try {
    await RPCTypes.teamsTeamLeaveRpcPromise(
      {name: teamname, permanent},
      Constants.leaveTeamWaitingKey(teamname)
    )
    logger.info(`leaveTeam: left ${teamname} successfully`)
    return TeamsGen.createLeftTeam({context, teamname})
  } catch (error) {
    if (error instanceof RPCError) {
      // handled through waiting store
      logger.warn('error:', error.message)
    }
  }
  return
}

const leftTeam = () => RouteTreeGen.createNavUpToScreen({name: 'teamsRoot'})

const getTeamRetentionPolicy = async (_: unknown, action: TeamsGen.GetTeamRetentionPolicyPayload) => {
  const {teamID} = action.payload
  let retentionPolicy = Constants.makeRetentionPolicy()
  try {
    const policy = await RPCChatTypes.localGetTeamRetentionLocalRpcPromise(
      {teamID},
      Constants.teamWaitingKey(teamID)
    )
    try {
      retentionPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(policy)
      if (retentionPolicy.type === 'inherit') {
        throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
      }
    } catch (error) {
      if (error instanceof RPCError) {
        logger.error(error.message)
      }
    }
  } catch (_) {}
  return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamID})
}

const updateTeamRetentionPolicy = (_: unknown, action: Chat2Gen.UpdateTeamRetentionPolicyPayload) => {
  const {metas} = action.payload
  const first = metas[0]
  if (!first) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetentionPolicy, teamID} = first
  try {
    return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy: teamRetentionPolicy, teamID})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(error.message)
      throw error
    }
  }
  return
}

const addReAddErrorHandler = (username: string, e: RPCError) => {
  // identify error
  if (e.code === RPCTypes.StatusCode.scidentifysummaryerror) {
    // show profile card
    ProfileConstants.useState.getState().dispatch.showUserProfile(username)
  }
  return undefined
}

const reAddToTeam = async (_: unknown, action: TeamsGen.ReAddToTeamPayload) => {
  const {teamID, username} = action.payload
  try {
    await RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise(
      {
        id: teamID,
        username,
      },
      Constants.addMemberWaitingKey(teamID, username)
    )
    return false
  } catch (error) {
    if (error instanceof RPCError) {
      return addReAddErrorHandler(username, error)
    }
  }
  return
}

const uploadAvatar = async (_: unknown, action: TeamsGen.UploadTeamAvatarPayload) => {
  const {crop, filename, sendChatNotification, teamname} = action.payload
  try {
    await RPCTypes.teamsUploadTeamAvatarRpcPromise(
      {crop, filename, sendChatNotification, teamname},
      uploadAvatarWaitingKey
    )
    return RouteTreeGen.createNavigateUp()
  } catch (error) {
    if (error instanceof RPCError) {
      // error displayed in component
      logger.warn(`Error uploading team avatar: ${error.message}`)
    }
  }
  return
}

const removeMember = async (_: Container.TypedState, action: TeamsGen.RemoveMemberPayload) => {
  const {teamID, username} = action.payload
  try {
    await RPCTypes.teamsTeamRemoveMemberRpcPromise(
      {
        member: {
          assertion: {assertion: username, removeFromSubtree: false},
          type: RPCTypes.TeamMemberToRemoveType.assertion,
        },
        teamID,
      },
      [Constants.teamWaitingKey(teamID), Constants.removeMemberWaitingKey(teamID, username)]
    )
  } catch (err) {
    logger.error('Failed to remove member', err)
    // TODO: create setEmailInviteError?`
  }
}

const removePendingInvite = async (_: Container.TypedState, action: TeamsGen.RemovePendingInvitePayload) => {
  const {teamID, inviteID} = action.payload
  try {
    await RPCTypes.teamsTeamRemoveMemberRpcPromise(
      {
        member: {inviteid: {inviteID}, type: RPCTypes.TeamMemberToRemoveType.inviteid},
        teamID,
      },
      [Constants.teamWaitingKey(teamID), Constants.removeMemberWaitingKey(teamID, inviteID)]
    )
  } catch (err) {
    logger.error('Failed to remove pending invite', err)
  }
}

const generateSMSBody = (teamname: string, seitan: string): string => {
  // seitan is 18chars
  // message sans teamname is 118chars. Teamname can be 33 chars before we truncate to 25 and pre-ellipsize
  let team: string
  const teamOrSubteam = teamname.includes('.') ? 'subteam' : 'team'
  if (teamname.length <= 33) {
    team = `${teamname} ${teamOrSubteam}`
  } else {
    team = `..${teamname.substring(teamname.length - 30)} subteam`
  }
  return `Join the ${team} on Keybase. Copy this message into the "Teams" tab.\n\ntoken: ${seitan.toLowerCase()}\n\ninstall: keybase.io/_/go`
}

const inviteToTeamByPhone = async (_s: unknown, action: TeamsGen.InviteToTeamByPhonePayload) => {
  const {teamID, teamname, role, phoneNumber, fullName = '', loadingKey} = action.payload
  if (loadingKey) {
    // TODO <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<o use this code below
    // set(s => {
    //   const oldLoadingInvites = mapGetEnsureValue(s.teamNameToLoadingInvites, teamname, new Map())
    //   oldLoadingInvites.set(loadingKey, true)
    //   s.teamNameToLoadingInvites.set(teamname, oldLoadingInvites)
    // })
    // listenerApi.dispatch(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
  }
  try {
    const seitan = await RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise(
      {
        label: {sms: {f: fullName || '', n: phoneNumber} as RPCTypes.SeitanKeyLabelSms, t: 1},
        role: (!!role && RPCTypes.TeamRole[role]) || RPCTypes.TeamRole.none,
        teamname: teamname,
      },
      [Constants.teamWaitingKey(teamID)]
    )
    /* Open SMS */
    const bodyText = generateSMSBody(teamname, seitan)
    await openSMS([phoneNumber], bodyText)
    if (loadingKey) {
      //TODO <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< use above
      // return TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname})
    }
    return false
  } catch (err) {
    logger.info('Error sending SMS', err)
    if (loadingKey) {
      //TODO <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< use above
      // return TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname})
    }
    return false
  }
}

const ignoreRequest = async (_: unknown, action: TeamsGen.IgnoreRequestPayload) => {
  const {teamID, teamname, username} = action.payload
  try {
    await RPCTypes.teamsTeamIgnoreRequestRpcPromise(
      {name: teamname, username},
      Constants.teamWaitingKey(teamID)
    )
  } catch (_) {
    // TODO handle error
  }
  return false
}

const saveChannelMembership = async (
  _s: unknown,
  action: TeamsGen.SaveChannelMembershipPayload,
  listenerApi: Container.ListenerApi
) => {
  const {teamID, oldChannelState, newChannelState} = action.payload
  const waitingKey = Constants.teamWaitingKey(teamID)

  for (const convIDKeyStr in newChannelState) {
    const conversationIDKey = ChatTypes.stringToConversationIDKey(convIDKeyStr)
    if (oldChannelState[conversationIDKey] === newChannelState[conversationIDKey]) {
      continue
    }
    if (newChannelState[conversationIDKey]) {
      try {
        const convID = ChatTypes.keyToConversationID(conversationIDKey)
        await RPCChatTypes.localJoinConversationByIDLocalRpcPromise({convID}, waitingKey)
        listenerApi.dispatch(TeamsGen.createAddParticipant({conversationIDKey, teamID}))
      } catch (error) {
        ConfigConstants.useConfigState.getState().dispatch.setGlobalError(error)
      }
    } else {
      try {
        const convID = ChatTypes.keyToConversationID(conversationIDKey)
        await RPCChatTypes.localLeaveConversationLocalRpcPromise({convID}, waitingKey)
        listenerApi.dispatch(TeamsGen.createRemoveParticipant({conversationIDKey, teamID}))
      } catch (error) {
        ConfigConstants.useConfigState.getState().dispatch.setGlobalError(error)
      }
    }
  }
}

const createChannel = async (
  _: unknown,
  action: TeamsGen.CreateChannelPayload,
  listenerApi: Container.ListenerApi
) => {
  const {channelname, description, teamID} = action.payload
  const teamname = Constants.getTeamNameFromID(Constants.useState.getState(), teamID)

  if (teamname === undefined) {
    logger.warn('Team name was not in store!')
    return
  }

  try {
    const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
      {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.team,
        tlfName: teamname,
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicName: channelname,
        topicType: RPCChatTypes.TopicType.chat,
      },
      Constants.createChannelWaitingKey(teamID)
    )

    // No error if we get here.
    const newConversationIDKey = result ? ChatTypes.conversationIDToKey(result.conv.info.id) : null
    if (!newConversationIDKey) {
      logger.warn('No convoid from newConvoRPC')
      return
    }

    // If we were given a description, set it
    if (description) {
      await RPCChatTypes.localPostHeadlineNonblockRpcPromise(
        {
          clientPrev: 0,
          conversationID: result.conv.info.id,
          headline: description,
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          tlfName: teamname ?? '',
          tlfPublic: false,
        },
        Constants.createChannelWaitingKey(teamID)
      )
    }

    // Dismiss the create channel dialog.
    const visibleScreen = Router2Constants.getVisibleScreen()
    if (visibleScreen && visibleScreen.name === 'chatCreateChannel') {
      listenerApi.dispatch(RouteTreeGen.createClearModals())
    }
    // Reload on team page
    Constants.useState.getState().dispatch.loadTeamChannelList(teamID)
    // Select the new channel, and switch to the chat tab.
    if (action.payload.navToChatOnSuccess) {
      listenerApi.dispatch(
        Chat2Gen.createPreviewConversation({
          channelname,
          conversationIDKey: newConversationIDKey,
          reason: 'newChannel',
          teamname,
        })
      )
    }
  } catch (error) {
    if (error instanceof RPCError) {
      Constants.useState.getState().dispatch.setChannelCreationError(error.desc)
    }
  }
}

const setPublicity = async (_: unknown, action: TeamsGen.SetPublicityPayload) => {
  const {teamID, settings} = action.payload
  const waitingKey = Constants.settingsWaitingKey(teamID)
  const teamMeta = Constants.getTeamMeta(Constants.useState.getState(), teamID)
  const teamSettings = (Constants.useState.getState().teamDetails.get(teamID) ?? Constants.emptyTeamDetails)
    .settings

  const ignoreAccessRequests = teamSettings.tarsDisabled
  const openTeam = teamSettings.open
  const openTeamRole = teamSettings.openJoinAs
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamSettings.teamShowcased

  if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
    try {
      await RPCTypes.teamsTeamSetSettingsRpcPromise(
        {
          settings: {joinAs: RPCTypes.TeamRole[settings.openTeamRole], open: settings.openTeam},
          teamID,
        },
        waitingKey
      )
    } catch (payload) {
      ConfigConstants.useConfigState.getState().dispatch.setGlobalError(payload)
    }
  }
  if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
    try {
      await RPCTypes.teamsSetTarsDisabledRpcPromise(
        {disabled: settings.ignoreAccessRequests, teamID},
        waitingKey
      )
    } catch (payload) {
      ConfigConstants.useConfigState.getState().dispatch.setGlobalError(payload)
    }
  }
  if (publicityAnyMember !== settings.publicityAnyMember) {
    try {
      await RPCTypes.teamsSetTeamShowcaseRpcPromise(
        {anyMemberShowcase: settings.publicityAnyMember, teamID},
        waitingKey
      )
    } catch (payload) {
      ConfigConstants.useConfigState.getState().dispatch.setGlobalError(payload)
    }
  }
  if (publicityMember !== settings.publicityMember) {
    try {
      await RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
        {isShowcased: settings.publicityMember, teamID},
        waitingKey
      )
    } catch (payload) {
      ConfigConstants.useConfigState.getState().dispatch.setGlobalError(payload)
    }
  }
  if (publicityTeam !== settings.publicityTeam) {
    try {
      await RPCTypes.teamsSetTeamShowcaseRpcPromise({isShowcased: settings.publicityTeam, teamID}, waitingKey)
    } catch (payload) {
      ConfigConstants.useConfigState.getState().dispatch.setGlobalError(payload)
    }
  }
}

const teamChangedByID = (
  state: Container.TypedState,
  action: EngineGen.Keybase1NotifyTeamTeamChangedByIDPayload
) => {
  const {teamID, latestHiddenSeqno, latestOffchainSeqno, latestSeqno} = action.payload.params
  // Any of the Seqnos can be 0, which means that it was unknown at the source
  // at the time when this notification was generated.
  const version = state.teams.teamVersion.get(teamID)
  let versionChanged = true
  if (version) {
    versionChanged =
      latestHiddenSeqno > version.latestHiddenSeqno ||
      latestOffchainSeqno > version.latestOffchainSeqno ||
      latestSeqno > version.latestSeqno
  }
  const shouldLoad =
    versionChanged && !!Constants.useState.getState().teamDetailsSubscriptionCount.get(teamID)
  return [
    TeamsGen.createSetTeamVersion({teamID, version: {latestHiddenSeqno, latestOffchainSeqno, latestSeqno}}),
    shouldLoad && Constants.useState.getState().dispatch.loadTeam(teamID),
  ]
}

const teamDeletedOrExit = () => {
  if (Router2Constants.getTab() == Tabs.teamsTab) {
    return RouteTreeGen.createNavUpToScreen({name: 'teamsRoot'})
  }
  return false
}

const updateTopic = async (_: unknown, action: TeamsGen.UpdateTopicPayload) => {
  const {teamID, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: Constants.getTeamNameFromID(Constants.useState.getState(), teamID) ?? '',
    tlfPublic: false,
  }

  await RPCChatTypes.localPostHeadlineRpcPromise(param, Constants.updateChannelNameWaitingKey(teamID))
  return []
}

const updateChannelname = async (_: unknown, action: TeamsGen.UpdateChannelNamePayload) => {
  const {teamID, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: Constants.getTeamNameFromID(Constants.useState.getState(), teamID) ?? '',
    tlfPublic: false,
  }

  try {
    await RPCChatTypes.localPostMetadataRpcPromise(param, Constants.updateChannelNameWaitingKey(teamID))
  } catch (error) {
    if (error instanceof RPCError) {
      Constants.useState.getState().dispatch.setChannelCreationError(error.desc)
    }
  }
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

const getMembers = async (_: unknown, action: TeamsGen.GetMembersPayload) => {
  const {teamID} = action.payload
  try {
    const res = await RPCTypes.teamsTeamGetMembersByIDRpcPromise({
      id: teamID,
    })
    const members = Constants.rpcDetailsToMemberInfos(res ?? [])
    return TeamsGen.createSetMembers({members, teamID})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`Error updating members for ${teamID}: ${error.desc}`)
    }
  }
  return
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

const clearNavBadges = async () => {
  try {
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'team.newly_added_to_team'})
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'team.delete'})
  } catch (err) {
    logError(err)
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

const loadTeamTreeActivity = async (
  _: unknown,
  action: EngineGen.Keybase1NotifyTeamTeamTreeMembershipsPartialPayload
) => {
  const {membership} = action.payload.params
  if (RPCTypes.TeamTreeMembershipStatus.ok !== membership.result.s) {
    return
  }
  const teamID = membership.result.ok.teamID
  const username = membership.targetUsername
  const waitingKey = Constants.loadTeamTreeActivityWaitingKey(teamID, username)

  try {
    const activityMap = await RPCChatTypes.localGetLastActiveAtMultiLocalRpcPromise(
      {
        teamIDs: [teamID],
        username,
      },
      waitingKey
    )
    return TeamsGen.createSetMemberActivityDetails({
      activityMap: new Map(Object.entries(activityMap)),
      username,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`loadTeamTreeActivity: unable to get activity for ${teamID}:${username}: ${error.message}`)
    }
  }
  return
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

const maybeClearBadges = (_: unknown, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  if (
    prev &&
    Router2Constants.getTab(prev) === Tabs.teamsTab &&
    next &&
    Router2Constants.getTab(next) !== Tabs.teamsTab
  ) {
    return TeamsGen.createClearNavBadges()
  }
  return false
}

const initTeams = () => {
  Container.listenAction(TeamsGen.leaveTeam, leaveTeam)
  Container.listenAction(TeamsGen.deleteTeam, deleteTeam)
  Container.listenAction(TeamsGen.getTeamProfileAddList, getTeamProfileAddList)
  Container.listenAction(TeamsGen.leftTeam, leftTeam)

  Container.listenAction(TeamsGen.getMembers, getMembers)
  Container.listenAction([ConfigGen.loadOnStart, TeamsGen.leftTeam], (_, action) => {
    if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
      return
    }
    Constants.useState.getState().dispatch.getTeams()
  })
  Container.listenAction(TeamsGen.saveChannelMembership, saveChannelMembership)
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

  Container.listenAction(TeamsGen.createChannel, createChannel)
  Container.listenAction(TeamsGen.reAddToTeam, reAddToTeam)
  Container.listenAction(TeamsGen.ignoreRequest, ignoreRequest)
  Container.listenAction(TeamsGen.uploadTeamAvatar, uploadAvatar)
  Container.listenAction(TeamsGen.removeMember, removeMember)
  Container.listenAction(TeamsGen.removePendingInvite, removePendingInvite)
  Container.listenAction(TeamsGen.updateTopic, updateTopic)
  Container.listenAction(TeamsGen.updateChannelName, updateChannelname)
  Container.listenAction(TeamsGen.deleteChannelConfirmed, deleteChannelConfirmed)
  Container.listenAction(TeamsGen.deleteMultiChannelsConfirmed, deleteMultiChannelsConfirmed)
  Container.listenAction(TeamsGen.inviteToTeamByPhone, inviteToTeamByPhone)
  Container.listenAction(TeamsGen.setPublicity, setPublicity)
  Container.listenAction(TeamsGen.getTeamRetentionPolicy, getTeamRetentionPolicy)
  Container.listenAction(Chat2Gen.updateTeamRetentionPolicy, updateTeamRetentionPolicy)
  Container.listenAction(TeamsGen.renameTeam, renameTeam)
  Container.listenAction(TeamsGen.manageChatChannels, manageChatChannels)
  Container.listenAction(GregorGen.pushState, gregorPushState)
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamChangedByID, teamChangedByID)
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

  Container.listenAction(TeamsGen.clearNavBadges, clearNavBadges)

  Container.listenAction(TeamsGen.showTeamByName, showTeamByName)

  Container.listenAction(TeamsGen.loadTeamTree, loadTeamTree)
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial, loadTeamTreeActivity)

  Container.listenAction(TeamsGen.teamSeen, teamSeen)
  Container.listenAction(RouteTreeGen.onNavChanged, maybeClearBadges)

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
}

export default initTeams

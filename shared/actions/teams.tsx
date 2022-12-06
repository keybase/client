/// TODO the relationships here are often inverted. we want to clear actions when a bunch of actions happen
// not have every handler clear it themselves. this reduces the number of actionChains
import * as EngineGen from './engine-gen-gen'
import * as TeamBuildingGen from './team-building-gen'
import * as TeamsGen from './teams-gen'
import * as ProfileGen from './profile-gen'
import * as Types from '../constants/types/teams'
import * as Constants from '../constants/teams'
import * as ChatConstants from '../constants/chat2'
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
import {RPCError, convertToError, logError} from '../util/errors'
import * as Container from '../util/container'
import {mapGetEnsureValue} from '../util/map'
import logger from '../logger'

async function createNewTeam(_: unknown, action: TeamsGen.CreateNewTeamPayload) {
  const {fromChat, joinSubteam, teamname, thenAddMembers} = action.payload
  try {
    const {teamID} = await RPCTypes.teamsTeamCreateRpcPromise(
      {joinSubteam, name: teamname},
      Constants.teamCreationWaitingKey
    )

    const addMembers = thenAddMembers ? [TeamsGen.createAddToTeam({...thenAddMembers, teamID})] : []
    return [TeamsGen.createTeamCreated({fromChat: !!fromChat, teamID, teamname}), ...addMembers]
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return TeamsGen.createSetTeamCreationError({error: error.desc})
  }
}
const showTeamAfterCreation = (_: unknown, action: TeamsGen.TeamCreatedPayload) => {
  const {teamID, teamname} = action.payload
  if (action.payload.fromChat) {
    return [
      RouteTreeGen.createClearModals(),
      Chat2Gen.createNavigateToInbox(),
      Chat2Gen.createPreviewConversation({channelname: 'general', reason: 'convertAdHoc', teamname}),
    ]
  }
  return [
    RouteTreeGen.createClearModals(),
    RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}),
    ...(Container.isMobile
      ? []
      : [
          RouteTreeGen.createNavigateAppend({
            path: [{props: {createdTeam: true, teamID}, selected: 'profileEditAvatar'}],
          }),
        ]),
  ]
}

const openInviteLink = () => {
  return RouteTreeGen.createNavigateAppend({
    path: ['teamInviteLinkJoin'],
  })
}
const joinTeam = async (
  _: Container.TypedState,
  action: TeamsGen.JoinTeamPayload,
  listenerApi: Container.ListenerApi
) => {
  const {teamname} = action.payload

  /*
                                In the deeplink flow, a modal is displayed which runs `joinTeam` (or an
                                alternative flow, but we're not concerned with that here). In that case,
                                we can fully manage the UX from inside of this handler.
                              
                                In the "Join team" flow, user pastes their link into the input box, which
                                then calls `joinTeam` on its own. Since we need to switch to another modal,
                                we simply plumb `deeplink` into the `promptInviteLinkJoin` handler and
                                do the nav in the modal.
                              */

  listenerApi.dispatch(TeamsGen.createSetTeamJoinError({error: ''}))
  listenerApi.dispatch(TeamsGen.createSetTeamJoinSuccess({open: false, success: false, teamname: ''}))
  try {
    const result = await RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.teamsUi.confirmInviteLinkAccept': async (params, response) => {
            const deeplink = action.payload.deeplink || false
            listenerApi.dispatch(TeamsGen.createUpdateInviteLinkDetails({details: params.details}))
            if (!deeplink) {
              listenerApi.dispatch(
                RouteTreeGen.createNavigateAppend({path: ['teamInviteLinkJoin'], replace: true})
              )
            }
            const [act] = await listenerApi.take<TeamsGen.RespondToInviteLinkPayload>(
              action => action.type === TeamsGen.respondToInviteLink
            )
            response.result(act.payload.accept)
          },
        },
        incomingCallMap: {},
        params: {tokenOrName: teamname},
        waitingKey: Constants.joinTeamWaitingKey,
      },
      listenerApi
    )

    // Success
    listenerApi.dispatch(
      TeamsGen.createSetTeamJoinSuccess({
        open: result?.wasOpenTeam ?? false,
        success: true,
        teamname: result?.wasTeamName ? teamname : '',
      })
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    const desc =
      error.code === RPCTypes.StatusCode.scteaminvitebadtoken
        ? 'Sorry, that team name or token is not valid.'
        : error.code === RPCTypes.StatusCode.scnotfound
        ? 'This invitation is no longer valid, or has expired.'
        : error.desc
    listenerApi.dispatch(TeamsGen.createSetTeamJoinError({error: desc}))
  }
}
const requestInviteLinkDetails = async (state: Container.TypedState) => {
  try {
    const details = await RPCTypes.teamsGetInviteLinkDetailsRpcPromise({
      inviteID: state.teams.teamInviteDetails.inviteID,
    })
    return TeamsGen.createUpdateInviteLinkDetails({
      details,
    })
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    const desc =
      error.code === RPCTypes.StatusCode.scteaminvitebadtoken
        ? 'Sorry, that invite token is not valid.'
        : error.code === RPCTypes.StatusCode.scnotfound
        ? 'This invitation is no longer valid, or has expired.'
        : error.desc
    return TeamsGen.createSetTeamJoinError({
      error: desc,
    })
  }
}

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
    if (!(error instanceof RPCError)) {
      return
    }
    // handled through waiting store
    logger.warn('error:', error.message)
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
    if (!(error instanceof RPCError)) {
      return
    }
    // handled through waiting store
    logger.warn('error:', error.message)
  }
  return
}

const leftTeam = () => RouteTreeGen.createNavUpToScreen({name: 'teamsRoot'})

const loadWelcomeMessage = async (_: unknown, action: TeamsGen.LoadWelcomeMessagePayload) => {
  const {teamID} = action.payload
  try {
    const message = await RPCChatTypes.localGetWelcomeMessageRpcPromise(
      {teamID},
      Constants.loadWelcomeMessageWaitingKey(teamID)
    )
    return TeamsGen.createLoadedWelcomeMessage({message, teamID})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(error)
    return TeamsGen.createSettingsError({error: error.desc})
  }
}

const setWelcomeMessage = async (_: unknown, action: TeamsGen.SetWelcomeMessagePayload) => {
  const {message, teamID} = action.payload
  try {
    await RPCChatTypes.localSetWelcomeMessageRpcPromise(
      {message, teamID},
      Constants.setWelcomeMessageWaitingKey(teamID)
    )
    return TeamsGen.createLoadWelcomeMessage({teamID})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(error)
    return TeamsGen.createSetWelcomeMessageError({error: error.desc})
  }
}

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
      if (!(error instanceof RPCError)) {
        throw error
      }
      logger.error(error.message)
    }
  } catch (_) {}
  return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamID})
}

const saveTeamRetentionPolicy = async (_: unknown, action: TeamsGen.SaveTeamRetentionPolicyPayload) => {
  const {teamID, policy} = action.payload

  let servicePolicy: RPCChatTypes.RetentionPolicy
  try {
    servicePolicy = Constants.retentionPolicyToServiceRetentionPolicy(policy)
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(error.message)
    return TeamsGen.createSettingsError({error: error.desc})
  }
  await RPCChatTypes.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
    Constants.teamWaitingKey(teamID),
    Constants.retentionWaitingKey(teamID),
  ])
  return
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
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(error.message)
    throw error
  }
}

const inviteByEmail = async (
  _: Container.TypedState,
  action: TeamsGen.InviteToTeamByEmailPayload,
  listenerApi: Container.ListenerApi
) => {
  const {invitees, role, teamID, teamname, loadingKey} = action.payload
  if (loadingKey) {
    listenerApi.dispatch(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
  }
  try {
    const res = await RPCTypes.teamsTeamAddEmailsBulkRpcPromise(
      {
        emails: invitees,
        name: teamname,
        role: role ? RPCTypes.TeamRole[role] : RPCTypes.TeamRole.none,
      },
      [Constants.teamWaitingKey(teamID), Constants.addToTeamByEmailWaitingKey(teamname)]
    )
    if (res.malformed && res.malformed.length > 0) {
      const malformed = res.malformed
      logger.warn(`teamInviteByEmail: Unable to parse ${malformed.length} email addresses`)
      listenerApi.dispatch(
        TeamsGen.createSetEmailInviteError({
          malformed,
          // mobile can only invite one at a time, show bad email in error message
          message: Container.isMobile
            ? `Error parsing email: ${malformed[0]}`
            : `There was an error parsing ${malformed.length} address${malformed.length > 1 ? 'es' : ''}.`,
        })
      )
    } else {
      // no malformed emails, assume everything went swimmingly
      listenerApi.dispatch(
        TeamsGen.createSetEmailInviteError({
          malformed: [],
          message: '',
        })
      )
      if (!Container.isMobile) {
        // mobile does not nav away
        listenerApi.dispatch(RouteTreeGen.createClearModals())
      }
    }
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // other error. display messages and leave all emails in input box
    listenerApi.dispatch(TeamsGen.createSetEmailInviteError({malformed: [], message: error.desc}))
  } finally {
    if (loadingKey) {
      listenerApi.dispatch(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
    }
  }
}

const addReAddErrorHandler = (username: string, e: RPCError) => {
  // identify error
  if (e.code === RPCTypes.StatusCode.scidentifysummaryerror) {
    // show profile card
    return ProfileGen.createShowUserProfile({username})
  }
  return undefined
}

const addToTeam = async (_: unknown, action: TeamsGen.AddToTeamPayload) => {
  const {fromTeamBuilder, teamID, users, sendChatNotification} = action.payload
  try {
    const res = await RPCTypes.teamsTeamAddMembersMultiRoleRpcPromise(
      {
        sendChatNotification,
        teamID,
        users: users.map(({assertion, role}) => ({
          assertion: assertion,
          role: RPCTypes.TeamRole[role],
        })),
      },
      [
        Constants.teamWaitingKey(teamID),
        Constants.addMemberWaitingKey(teamID, ...users.map(({assertion}) => assertion)),
      ]
    )
    if (res.notAdded && res.notAdded.length > 0) {
      const usernames = res.notAdded.map(elem => elem.username)
      return [
        TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {source: 'teamAddSomeFailed', usernames}, selected: 'contactRestricted'}],
        }),
      ]
    }
    return TeamsGen.createAddedToTeam({fromTeamBuilder})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    // If all of the users couldn't be added due to contact settings, the RPC fails.
    if (error.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      const users = (error.fields as Array<{key?: string; value?: string} | undefined> | undefined)
        ?.filter(elem => elem?.key === 'usernames')
        .map(elem => elem?.value)
      const usernames = users?.[0]?.split(',')
      return [
        TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {source: 'teamAddAllFailed', usernames}, selected: 'contactRestricted'}],
        }),
      ]
    }
    // TODO this should not error on member already in team
    return TeamsGen.createAddedToTeam({error: error.desc, fromTeamBuilder})
  }
}

const closeTeamBuilderOrSetError = (_: unknown, action: TeamsGen.AddedToTeamPayload) => {
  const {error, fromTeamBuilder} = action.payload
  if (!fromTeamBuilder) {
    return
  }
  return error
    ? TeamBuildingGen.createSetError({error, namespace: 'teams'})
    : TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'})
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
    if (!(error instanceof RPCError)) {
      return
    }
    return addReAddErrorHandler(username, error)
  }
}

const editDescription = async (_: unknown, action: TeamsGen.EditTeamDescriptionPayload) => {
  const {teamID, description} = action.payload
  try {
    await RPCTypes.teamsSetTeamShowcaseRpcPromise({description, teamID}, Constants.teamWaitingKey(teamID))
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return TeamsGen.createSetEditDescriptionError({error: error.message})
  }
  return []
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
    if (!(error instanceof RPCError)) {
      return
    }
    // error displayed in component
    logger.warn(`Error uploading team avatar: ${error.message}`)
  }
  return
}

const editMembership = async (_: unknown, action: TeamsGen.EditMembershipPayload) => {
  const {teamID, usernames, role: _role} = action.payload
  const role = _role ? RPCTypes.TeamRole[_role] : RPCTypes.TeamRole.none
  try {
    await RPCTypes.teamsTeamEditMembersRpcPromise(
      {
        teamID,
        users: usernames.map(assertion => ({assertion, role})),
      },
      [Constants.teamWaitingKey(teamID), Constants.editMembershipWaitingKey(teamID, ...usernames)]
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (usernames.length === 1) {
      // error is shown in the member page
      return TeamsGen.createSetEditMemberError({error: error.message, teamID, username: usernames[0]})
    }
  }
  return false
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

const inviteToTeamByPhone = async (
  _s: unknown,
  action: TeamsGen.InviteToTeamByPhonePayload,
  listenerApi: Container.ListenerApi
) => {
  const {teamID, teamname, role, phoneNumber, fullName = '', loadingKey} = action.payload
  if (loadingKey) {
    listenerApi.dispatch(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
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
      return TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname})
    }
    return false
  } catch (err) {
    logger.info('Error sending SMS', err)
    if (loadingKey) {
      return TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname})
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

function createNewTeamFromConversation(
  state: Container.TypedState,
  action: TeamsGen.CreateNewTeamFromConversationPayload
) {
  const {conversationIDKey, teamname} = action.payload
  const me = state.config.username

  const participantInfo = ChatConstants.getParticipantInfo(state, conversationIDKey)
  // exclude bots from the newly created team, they can be added back later.
  const participants = participantInfo.name.filter(p => p !== me) // we will already be in as 'owner'
  const users = participants.map(assertion => ({
    assertion,
    role: assertion === me ? ('admin' as const) : ('writer' as const),
  }))

  return TeamsGen.createCreateNewTeam({
    fromChat: true,
    joinSubteam: false,
    teamname,
    thenAddMembers: {sendChatNotification: true, users},
  })
}

const loadTeam = async (state: Container.TypedState, action: TeamsGen.LoadTeamPayload) => {
  const {_subscribe, teamID} = action.payload

  if (!teamID || teamID === Types.noTeamID) {
    logger.warn(`bail on invalid team ID ${teamID}`)
    return
  }

  // If we're already subscribed to team details for this team ID, we're already up to date
  const subscriptions = state.teams.teamDetailsSubscriptionCount.get(teamID) ?? 0
  if (_subscribe && subscriptions > 1) {
    logger.info('bail on already subscribed')
    return
  }

  try {
    const team = await RPCTypes.teamsGetAnnotatedTeamRpcPromise({teamID})
    return TeamsGen.createTeamLoaded({team, teamID})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(error.message)
  }
  return
}

const addUserToTeams = async (state: Container.TypedState, action: TeamsGen.AddUserToTeamsPayload) => {
  const {role, teams, user} = action.payload
  const teamsAddedTo: Array<string> = []
  const errorAddingTo: Array<string> = []
  for (const team of teams) {
    try {
      const teamID = Constants.getTeamID(state, team)
      if (teamID === Types.noTeamID) {
        logger.warn(`no team ID found for ${team}`)
        errorAddingTo.push(team)
        continue
      }
      await RPCTypes.teamsTeamAddMemberRpcPromise(
        {
          email: '',
          phone: '',
          role: RPCTypes.TeamRole[role],
          sendChatNotification: true,
          teamID,
          username: user,
        },
        [Constants.teamWaitingKey(teamID), Constants.addUserToTeamsWaitingKey(user)]
      )
      teamsAddedTo.push(team)
    } catch (error) {
      errorAddingTo.push(team)
    }
  }

  // TODO: We should split these results into two messages, showing one in green and
  // the other in red instead of lumping them together.

  let result = ''

  if (teamsAddedTo.length) {
    result += `${user} was added to `
    if (teamsAddedTo.length > 3) {
      result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo.length - 2} teams.`
    } else if (teamsAddedTo.length === 3) {
      result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo[2]}.`
    } else if (teamsAddedTo.length === 2) {
      result += `${teamsAddedTo[0]} and ${teamsAddedTo[1]}.`
    } else {
      result += `${teamsAddedTo[0]}.`
    }
  }

  if (errorAddingTo.length) {
    if (result.length > 0) {
      result += ' But we '
    } else {
      result += 'We '
    }
    result += `were unable to add ${user} to ${errorAddingTo.join(', ')}.`
  }
  return TeamsGen.createSetAddUserToTeamsResults({
    error: errorAddingTo.length > 0,
    results: result,
  })
}

const getTeams = async (
  state: Container.TypedState,
  action: ConfigGen.LoadOnStartPayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload
) => {
  if (action.type === ConfigGen.loadOnStart && action.payload.phase !== 'startupOrReloginButNotInARush') {
    return
  }
  const username = state.config.username
  if (!username) {
    logger.warn('getTeams while logged out')
    return
  }
  if (action.type === TeamsGen.getTeams) {
    const {forceReload} = action.payload
    if (!forceReload && !state.teams.teamMetaStale) {
      // bail
      return
    }
  }
  try {
    const results = await RPCTypes.teamsTeamListUnverifiedRpcPromise(
      {includeImplicitTeams: false, userAssertion: username},
      Constants.teamsLoadedWaitingKey
    )
    const teams: Array<RPCTypes.AnnotatedMemberInfo> = results.teams || []
    const teamnames: Array<string> = []
    const teamNameToID = new Map<string, Types.TeamID>()
    teams.forEach(team => {
      teamnames.push(team.fqName)
      teamNameToID.set(team.fqName, team.teamID)
    })
    const teamNameSet = new Set<string>(teamnames)
    return TeamsGen.createSetTeamInfo({
      teamMeta: Constants.teamListToMeta(teams),
      teamNameToID,
      teamnames: teamNameSet,
    })
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (error.code === RPCTypes.StatusCode.scapinetworkerror) {
      // Ignore API errors due to offline
    } else {
      logger.error(error)
    }
  }
  return
}

const getActivityForTeams = async () => {
  try {
    const results = await RPCChatTypes.localGetLastActiveForTeamsRpcPromise()
    const teams = Object.entries(results.teams).reduce<Map<Types.TeamID, Types.ActivityLevel>>(
      (res, [teamID, status]) => {
        if (status === RPCChatTypes.LastActiveStatus.none) {
          return res
        }
        res.set(teamID, Constants.lastActiveStatusToActivityLevel[status])
        return res
      },
      new Map()
    )
    const channels = Object.entries(results.channels).reduce<
      Map<ChatTypes.ConversationIDKey, Types.ActivityLevel>
    >((res, [conversationIDKey, status]) => {
      if (status === RPCChatTypes.LastActiveStatus.none) {
        return res
      }
      res.set(conversationIDKey, Constants.lastActiveStatusToActivityLevel[status])
      return res
    }, new Map())
    return TeamsGen.createSetActivityLevels({levels: {channels, loaded: true, teams}})
  } catch (e) {
    logger.warn(e)
  }
  return
}

const checkRequestedAccess = async () => {
  const result = await RPCTypes.teamsTeamListMyAccessRequestsRpcPromise(
    {},
    Constants.teamsAccessRequestWaitingKey
  )
  const teams = (result || []).map(row => (row?.parts ? row.parts.join('.') : ''))
  return TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: new Set<Types.Teamname>(teams)})
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
        if (!(error instanceof RPCError)) {
          return
        }
        listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(error)}))
      }
    } else {
      try {
        const convID = ChatTypes.keyToConversationID(conversationIDKey)
        await RPCChatTypes.localLeaveConversationLocalRpcPromise({convID}, waitingKey)
        listenerApi.dispatch(TeamsGen.createRemoveParticipant({conversationIDKey, teamID}))
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(error)}))
      }
    }
  }
}

const createChannel = async (
  state: Container.TypedState,
  action: TeamsGen.CreateChannelPayload,
  listenerApi: Container.ListenerApi
) => {
  const {channelname, description, teamID} = action.payload
  const teamname = Constants.getTeamNameFromID(state, teamID)

  if (teamname === null) {
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
          tlfName: teamname,
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
    listenerApi.dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
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
    if (!(error instanceof RPCError)) {
      return
    }
    listenerApi.dispatch(TeamsGen.createSetChannelCreationError({error: error.desc}))
  }
}

const createChannels = async (state: Container.TypedState, action: TeamsGen.CreateChannelsPayload) => {
  const {teamID, channelnames} = action.payload
  const teamname = Constants.getTeamNameFromID(state, teamID)

  if (teamname === null) {
    return TeamsGen.createSetChannelCreationError({error: 'Invalid team name'})
  }

  try {
    for (const c of channelnames) {
      await RPCChatTypes.localNewConversationLocalRpcPromise({
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.team,
        tlfName: teamname,
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicName: c,
        topicType: RPCChatTypes.TopicType.chat,
      })
    }
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return TeamsGen.createSetChannelCreationError({error: error.desc})
  }
  return [
    TeamsGen.createSetCreatingChannels({creatingChannels: false}),
    TeamsGen.createLoadTeamChannelList({teamID}),
  ]
}

const setMemberPublicity = async (_: unknown, action: TeamsGen.SetMemberPublicityPayload) => {
  const {teamID, showcase} = action.payload
  try {
    await RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
      {
        isShowcased: showcase,
        teamID,
      },
      [Constants.teamWaitingKey(teamID), Constants.setMemberPublicityWaitingKey(teamID)]
    )
    return
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return TeamsGen.createSettingsError({error: error.desc})
  }
}

const setPublicity = async (
  state: Container.TypedState,
  action: TeamsGen.SetPublicityPayload,
  listenerApi: Container.ListenerApi
) => {
  const {teamID, settings} = action.payload
  const waitingKey = Constants.settingsWaitingKey(teamID)
  const teamMeta = Constants.getTeamMeta(state, teamID)
  const teamSettings = Constants.getTeamDetails(state, teamID).settings
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
    } catch (_payload) {
      const payload = _payload as Object
      listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(payload)}))
    }
  }
  if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
    try {
      await RPCTypes.teamsSetTarsDisabledRpcPromise(
        {disabled: settings.ignoreAccessRequests, teamID},
        waitingKey
      )
    } catch (_payload) {
      const payload = _payload as Object
      listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(payload)}))
    }
  }
  if (publicityAnyMember !== settings.publicityAnyMember) {
    try {
      await RPCTypes.teamsSetTeamShowcaseRpcPromise(
        {anyMemberShowcase: settings.publicityAnyMember, teamID},
        waitingKey
      )
    } catch (_payload) {
      const payload = _payload as Object
      listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(payload)}))
    }
  }
  if (publicityMember !== settings.publicityMember) {
    try {
      await RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
        {isShowcased: settings.publicityMember, teamID},
        waitingKey
      )
    } catch (_payload) {
      const payload = _payload as Object
      listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(payload)}))
    }
  }
  if (publicityTeam !== settings.publicityTeam) {
    try {
      await RPCTypes.teamsSetTeamShowcaseRpcPromise({isShowcased: settings.publicityTeam, teamID}, waitingKey)
    } catch (_payload) {
      const payload = _payload as Object
      listenerApi.dispatch(ConfigGen.createGlobalError({globalError: convertToError(payload)}))
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
  const shouldLoad = versionChanged && !!state.teams.teamDetailsSubscriptionCount.get(teamID)
  return [
    TeamsGen.createSetTeamVersion({teamID, version: {latestHiddenSeqno, latestOffchainSeqno, latestSeqno}}),
    shouldLoad && TeamsGen.createLoadTeam({teamID}),
  ]
}

const teamRoleMapChangedUpdateLatestKnownVersion = (
  _: unknown,
  action: EngineGen.Keybase1NotifyTeamTeamRoleMapChangedPayload
) => {
  const {newVersion} = action.payload.params
  return TeamsGen.createSetTeamRoleMapLatestKnownVersion({version: newVersion})
}

const refreshTeamRoleMap = async (
  state: Container.TypedState,
  action: EngineGen.Keybase1NotifyTeamTeamRoleMapChangedPayload | ConfigGen.BootstrapStatusLoadedPayload
) => {
  if (action.type === EngineGen.keybase1NotifyTeamTeamRoleMapChanged) {
    const {newVersion} = action.payload.params
    const loadedVersion = state.teams.teamRoleMap.loadedVersion
    logger.info(`Got teamRoleMapChanged with version ${newVersion}, loadedVersion is ${loadedVersion}`)
    if (loadedVersion >= newVersion) {
      return
    }
  }
  try {
    const map = await RPCTypes.teamsGetTeamRoleMapRpcPromise()
    return TeamsGen.createSetTeamRoleMap({map: Constants.rpcTeamRoleMapAndVersionToTeamRoleMap(map)})
  } catch {
    logger.info(`Failed to refresh TeamRoleMap; service will retry`)
    return
  }
}

const teamDeletedOrExit = () => {
  if (Router2Constants.getTab(null) == Tabs.teamsTab) {
    return RouteTreeGen.createNavUpToScreen({name: 'teamsRoot'})
  }
  return false
}

const reloadTeamListIfSubscribed = (state: Container.TypedState, _: unknown) => {
  if (state.teams.teamMetaSubscribeCount > 0) {
    logger.info('eagerly reloading')
    return TeamsGen.createGetTeams()
  } else {
    logger.info('skipping')
  }
  return false
}

const updateTopic = async (state: Container.TypedState, action: TeamsGen.UpdateTopicPayload) => {
  const {teamID, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: Constants.getTeamNameFromID(state, teamID) ?? '',
    tlfPublic: false,
  }

  await RPCChatTypes.localPostHeadlineRpcPromise(param, Constants.updateChannelNameWaitingKey(teamID))
  return []
}

const addTeamWithChosenChannels = async (
  state: Container.TypedState,
  action: TeamsGen.AddTeamWithChosenChannelsPayload
) => {
  const existingTeams = state.teams.teamsWithChosenChannels
  const {teamID} = action.payload
  const teamname = Constants.getTeamNameFromID(state, teamID)
  if (!teamname) {
    logger.warn('No team name in store for teamID:', teamID)
    return
  }
  if (state.teams.teamsWithChosenChannels.has(teamname)) {
    // we've already dismissed for this team and we already know about it, bail
    return
  }
  const logPrefix = `[addTeamWithChosenChannels]:${teamname}`
  let pushState: Unpacked<ReturnType<typeof RPCTypes.gregorGetStateRpcPromise>>
  try {
    pushState = await RPCTypes.gregorGetStateRpcPromise(undefined, Constants.teamWaitingKey(teamID))
  } catch (err) {
    // failure getting the push state, don't bother the user with an error
    // and don't try to move forward updating the state
    logger.error(`${logPrefix} error fetching gregor state: ${err}`)
    return
  }
  const item = pushState?.items?.find(i => i.item?.category === Constants.chosenChannelsGregorKey)
  let teams: Array<string> = []
  let msgID: Buffer | undefined
  if (item?.item?.body) {
    const body = item.item.body
    msgID = item.md?.msgID
    teams = GregorConstants.bodyToJSON(body)
  } else {
    logger.info(
      `${logPrefix} No item in gregor state found, making new item. Total # of items: ${
        pushState.items?.length || 0
      }`
    )
  }
  if (existingTeams.size > teams.length) {
    // Bad - we don't have an accurate view of things. Log and bail
    logger.warn(
      `${logPrefix} Existing list longer than list in gregor state, got list with length ${teams.length} when we have ${existingTeams.size} already. Bailing on update.`
    )
    return
  }
  teams.push(teamname)
  // make sure there're no dupes
  teams = [...new Set(teams)]

  const dtime = {
    offset: 0,
    time: 0,
  }
  // update if exists, else create
  if (msgID) {
    logger.info(`${logPrefix} Updating teamsWithChosenChannels`)
  } else {
    logger.info(`${logPrefix} Creating teamsWithChosenChannels`)
  }
  await RPCTypes.gregorUpdateCategoryRpcPromise(
    {
      body: JSON.stringify(teams),
      category: Constants.chosenChannelsGregorKey,
      dtime,
    },
    teams.map(t => Constants.teamWaitingKey(Constants.getTeamID(state, t)))
  )
}

const updateChannelname = async (state: Container.TypedState, action: TeamsGen.UpdateChannelNamePayload) => {
  const {teamID, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: Constants.getTeamNameFromID(state, teamID) ?? '',
    tlfPublic: false,
  }

  try {
    await RPCChatTypes.localPostMetadataRpcPromise(param, Constants.updateChannelNameWaitingKey(teamID))
    return false
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return TeamsGen.createSetChannelCreationError({error: error.desc})
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
  return TeamsGen.createLoadTeamChannelList({teamID})
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

  return TeamsGen.createLoadTeamChannelList({teamID})
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
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(`Error updating members for ${teamID}: ${error.desc}`)
  }
  return
}

const badgeAppForTeams = (
  state: Container.TypedState,
  action: NotificationsGen.ReceivedBadgeStatePayload
) => {
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    // Don't make any calls we don't have permission to.
    return
  }
  const {badgeState} = action.payload

  const actions: Array<Container.TypedActions> = []
  const deletedTeams = badgeState.deletedTeams || []
  const newTeams = new Set<string>(badgeState.newTeams || [])

  const teamsWithResetUsers: Array<RPCTypes.TeamMemberOutReset> = badgeState.teamsWithResetUsers || []
  const teamsWithResetUsersMap = new Map<Types.TeamID, Set<string>>()
  teamsWithResetUsers.forEach(entry => {
    const existing = mapGetEnsureValue(teamsWithResetUsersMap, entry.teamID, new Set())
    existing.add(entry.username)
  })

  // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
  actions.push(
    TeamsGen.createSetNewTeamInfo({
      deletedTeams,
      newTeams,
      teamIDToResetUsers: teamsWithResetUsersMap,
    })
  )
  return actions
}

const gregorPushState = (_: unknown, action: GregorGen.PushStatePayload) => {
  const actions: Array<Container.TypedActions> = []
  const items = action.payload.state
  let sawChatBanner = false
  let sawSubteamsBanner = false
  let chosenChannels: undefined | typeof items[0]
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
    actions.push(TeamsGen.createSetTeamSawChatBanner())
  }

  if (sawSubteamsBanner) {
    actions.push(TeamsGen.createSetTeamSawSubteamsBanner())
  }

  actions.push(TeamsGen.createSetNewTeamRequests({newTeamRequests}))

  const teamsWithChosenChannels = new Set<Types.Teamname>(
    GregorConstants.bodyToJSON(chosenChannels?.item.body)
  )

  actions.push(TeamsGen.createSetTeamsWithChosenChannels({teamsWithChosenChannels}))

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
  return [
    TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}),
    TeamsGen.createAddMembersWizardPushMembers({
      members: [...state.teams.teamBuilding.teamSoFar].map(user => ({assertion: user.id, role: 'writer'})),
    }),
  ]
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
    if (!(error instanceof RPCError)) {
      return
    }
    logger.info(`loadTeamTreeActivity: unable to get activity for ${teamID}:${username}: ${error.message}`)
  }
  return
}

const launchNewTeamWizardOrModal = (_: unknown, action: TeamsGen.LaunchNewTeamWizardOrModalPayload) => {
  return action.payload.subteamOf
    ? RouteTreeGen.createNavigateAppend({path: ['teamWizard2TeamInfo']})
    : TeamsGen.createStartNewTeamWizard()
}
const startNewTeamWizard = () => RouteTreeGen.createNavigateAppend({path: ['teamWizard1TeamPurpose']})
const setTeamWizardTeamType = () => RouteTreeGen.createNavigateAppend({path: ['teamWizard2TeamInfo']})
const setTeamWizardNameDescription = () =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {createdTeam: true, teamID: Types.newTeamWizardTeamID, wizard: true},
        selected: 'profileEditAvatar',
      },
    ],
  })
const setTeamWizardAvatar = (state: Container.TypedState) => {
  switch (state.teams.newTeamWizard.teamType) {
    case 'subteam': {
      const parentTeamID = state.teams.newTeamWizard.parentTeamID
      const parentTeamMeta = Constants.getTeamMeta(state, parentTeamID ?? '')
      // If it's just you, don't show the subteam members screen empty
      if (parentTeamMeta.memberCount > 1) {
        return RouteTreeGen.createNavigateAppend({path: ['teamWizardSubteamMembers']})
      } else {
        return TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
      }
    }
    case 'friends':
    case 'other':
      return TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
    case 'project':
      return RouteTreeGen.createNavigateAppend({path: ['teamWizard5Channels']})
    case 'community':
      return RouteTreeGen.createNavigateAppend({path: ['teamWizard4TeamSize']})
  }
}
const setTeamWizardSubteamMembers = () => RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamConfirm']})
const setTeamWizardTeamSize = (_: unknown, action: TeamsGen.SetTeamWizardTeamSizePayload) =>
  action.payload.isBig
    ? RouteTreeGen.createNavigateAppend({path: ['teamWizard5Channels']})
    : TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
const setTeamWizardChannels = () => RouteTreeGen.createNavigateAppend({path: ['teamWizard6Subteams']})
const setTeamWizardSubteams = () => TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
const startAddMembersWizard = () => RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamFromWhere']})
const finishNewTeamWizard = async (state: Container.TypedState) => {
  const {name, description, open, openTeamJoinRole, profileShowcase, addYourself} = state.teams.newTeamWizard
  const {avatarFilename, avatarCrop, channels, subteams} = state.teams.newTeamWizard
  const teamInfo: RPCTypes.TeamCreateFancyInfo = {
    avatar: avatarFilename ? {avatarFilename, crop: avatarCrop?.crop} : null,
    chatChannels: channels,
    description,
    joinSubteam: addYourself,
    name,
    openSettings: {joinAs: RPCTypes.TeamRole[openTeamJoinRole], open},
    profileShowcase,
    subteams,
    users: state.teams.addMembersWizard.addingMembers.map(member => ({
      assertion: member.assertion,
      role: RPCTypes.TeamRole[member.role],
    })),
  }
  try {
    const teamID = await RPCTypes.teamsTeamCreateFancyRpcPromise({teamInfo}, Constants.teamCreationWaitingKey)
    return TeamsGen.createFinishedNewTeamWizard({teamID})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return TeamsGen.createSetTeamWizardError({error: error.message})
  }
}

const finishedNewTeamWizard = (_: unknown, action: TeamsGen.FinishedNewTeamWizardPayload) => [
  RouteTreeGen.createClearModals(),
  RouteTreeGen.createNavigateAppend({path: [{props: {teamID: action.payload.teamID}, selected: 'team'}]}),
]

const addMembersWizardPushMembers = async (
  state: Container.TypedState,
  action: TeamsGen.AddMembersWizardPushMembersPayload
) => {
  // Call FindAssertionsInTeamNoResolve RPC and pass the results along with the
  // members to addMembersWizardSetMembers action.
  const {teamID} = state.teams.addMembersWizard
  const assertions = action.payload.members
    .filter(member => member.assertion.includes('@') || !!member.resolvedFrom)
    .map(({assertion}) => assertion)

  const existingAssertions =
    teamID === Types.newTeamWizardTeamID
      ? []
      : await RPCTypes.teamsFindAssertionsInTeamNoResolveRpcPromise({
          assertions,
          teamID,
        })

  return [
    TeamsGen.createAddMembersWizardAddMembers({
      assertionsInTeam: existingAssertions ?? [],
      members: action.payload.members,
    }),
    RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamConfirm']}),
  ]
}

const navAwayFromAddMembersWizard = () => RouteTreeGen.createClearModals()

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
    if (!(error instanceof RPCError)) {
      return
    }
    logger.error(error.message)
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

const loadTeamChannelList = async (
  state: Container.TypedState,
  action: TeamsGen.LoadTeamChannelListPayload
) => {
  const {teamID} = action.payload
  const teamname = Constants.getTeamMeta(state, teamID).teamname
  if (!teamname) {
    logger.warn('bailing on no teamMeta')
    return
  }
  try {
    const {convs} = await RPCChatTypes.localGetTLFConversationsLocalRpcPromise({
      membersType: RPCChatTypes.ConversationMembersType.team,
      tlfName: teamname,
      topicType: RPCChatTypes.TopicType.chat,
    })
    const channels =
      (convs || []).reduce<Map<ChatTypes.ConversationIDKey, Types.TeamChannelInfo>>((res, inboxUIItem) => {
        const conversationIDKey = ChatTypes.stringToConversationIDKey(inboxUIItem.convID)
        res.set(conversationIDKey, {
          channelname: inboxUIItem.channel,
          conversationIDKey,
          description: inboxUIItem.headline,
        })
        return res
      }, new Map()) ?? new Map()

    // ensure we refresh participants, but don't fail the saga if this somehow fails
    try {
      ;[...channels.values()].forEach(({conversationIDKey}) => {
        RPCChatTypes.localRefreshParticipantsRpcPromise({
          convID: ChatTypes.keyToConversationID(conversationIDKey),
        })
          .then(() => {})
          .catch(() => {})
      })
    } catch (e) {
      logger.error('this should never happen', e)
    }

    return TeamsGen.createTeamChannelListLoaded({channels, teamID})
  } catch (err) {
    logger.warn(err)
  }
  return false
}

const initTeams = () => {
  Container.listenAction(TeamsGen.leaveTeam, leaveTeam)
  Container.listenAction(TeamsGen.deleteTeam, deleteTeam)
  Container.listenAction(TeamsGen.getTeamProfileAddList, getTeamProfileAddList)
  Container.listenAction(TeamsGen.leftTeam, leftTeam)
  Container.listenAction(TeamsGen.createNewTeam, createNewTeam)
  Container.listenAction(TeamsGen.teamCreated, showTeamAfterCreation)

  Container.listenAction(TeamsGen.joinTeam, joinTeam)
  Container.listenAction(TeamsGen.openInviteLink, openInviteLink)
  Container.listenAction(TeamsGen.requestInviteLinkDetails, requestInviteLinkDetails)

  Container.listenAction(TeamsGen.loadTeam, loadTeam)
  Container.listenAction(TeamsGen.getMembers, getMembers)
  Container.listenAction(TeamsGen.createNewTeamFromConversation, createNewTeamFromConversation)
  Container.listenAction([ConfigGen.loadOnStart, TeamsGen.getTeams, TeamsGen.leftTeam], getTeams)
  Container.listenAction(TeamsGen.getActivityForTeams, getActivityForTeams)
  Container.listenAction(TeamsGen.saveChannelMembership, saveChannelMembership)
  Container.listenAction(
    [ConfigGen.bootstrapStatusLoaded, EngineGen.keybase1NotifyTeamTeamRoleMapChanged],
    refreshTeamRoleMap
  )

  Container.listenAction(TeamsGen.createChannel, createChannel)
  Container.listenAction(TeamsGen.addToTeam, addToTeam)
  Container.listenAction(TeamsGen.reAddToTeam, reAddToTeam)
  Container.listenAction(TeamsGen.addUserToTeams, addUserToTeams)
  Container.listenAction(TeamsGen.inviteToTeamByEmail, inviteByEmail)
  Container.listenAction(TeamsGen.ignoreRequest, ignoreRequest)
  Container.listenAction(TeamsGen.editTeamDescription, editDescription)
  Container.listenAction(TeamsGen.uploadTeamAvatar, uploadAvatar)
  Container.listenAction(TeamsGen.createChannels, createChannels)
  Container.listenAction(TeamsGen.editMembership, editMembership)
  Container.listenAction(TeamsGen.removeMember, removeMember)
  Container.listenAction(TeamsGen.removePendingInvite, removePendingInvite)
  Container.listenAction(TeamsGen.setMemberPublicity, setMemberPublicity)
  Container.listenAction(TeamsGen.updateTopic, updateTopic)
  Container.listenAction(TeamsGen.updateChannelName, updateChannelname)
  Container.listenAction(TeamsGen.deleteChannelConfirmed, deleteChannelConfirmed)
  Container.listenAction(TeamsGen.deleteMultiChannelsConfirmed, deleteMultiChannelsConfirmed)
  Container.listenAction(TeamsGen.inviteToTeamByPhone, inviteToTeamByPhone)
  Container.listenAction(TeamsGen.setPublicity, setPublicity)
  Container.listenAction(TeamsGen.checkRequestedAccess, checkRequestedAccess)
  Container.listenAction(TeamsGen.getTeamRetentionPolicy, getTeamRetentionPolicy)
  Container.listenAction(TeamsGen.saveTeamRetentionPolicy, saveTeamRetentionPolicy)
  Container.listenAction(Chat2Gen.updateTeamRetentionPolicy, updateTeamRetentionPolicy)
  Container.listenAction(TeamsGen.addTeamWithChosenChannels, addTeamWithChosenChannels)
  Container.listenAction(TeamsGen.renameTeam, renameTeam)
  Container.listenAction(TeamsGen.manageChatChannels, manageChatChannels)
  Container.listenAction(NotificationsGen.receivedBadgeState, badgeAppForTeams)
  Container.listenAction(GregorGen.pushState, gregorPushState)
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamChangedByID, teamChangedByID)
  Container.listenAction(
    EngineGen.keybase1NotifyTeamTeamRoleMapChanged,
    teamRoleMapChangedUpdateLatestKnownVersion
  )

  Container.listenAction(
    [EngineGen.keybase1NotifyTeamTeamDeleted, EngineGen.keybase1NotifyTeamTeamExit],
    teamDeletedOrExit
  )

  Container.listenAction(
    [EngineGen.keybase1NotifyTeamTeamMetadataUpdate, GregorGen.updateReachable],
    reloadTeamListIfSubscribed
  )

  Container.listenAction(TeamsGen.clearNavBadges, clearNavBadges)

  Container.listenAction(TeamsGen.showTeamByName, showTeamByName)

  Container.listenAction(TeamsGen.loadWelcomeMessage, loadWelcomeMessage)
  Container.listenAction(TeamsGen.setWelcomeMessage, setWelcomeMessage)

  Container.listenAction(TeamsGen.loadTeamTree, loadTeamTree)
  Container.listenAction(EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial, loadTeamTreeActivity)

  // New team wizard
  Container.listenAction(TeamsGen.launchNewTeamWizardOrModal, launchNewTeamWizardOrModal)
  Container.listenAction(TeamsGen.startNewTeamWizard, startNewTeamWizard)
  Container.listenAction(TeamsGen.setTeamWizardTeamType, setTeamWizardTeamType)
  Container.listenAction(TeamsGen.setTeamWizardNameDescription, setTeamWizardNameDescription)
  Container.listenAction(TeamsGen.setTeamWizardAvatar, setTeamWizardAvatar)
  Container.listenAction(TeamsGen.setTeamWizardTeamSize, setTeamWizardTeamSize)
  Container.listenAction(TeamsGen.setTeamWizardChannels, setTeamWizardChannels)
  Container.listenAction(TeamsGen.setTeamWizardSubteams, setTeamWizardSubteams)
  Container.listenAction(TeamsGen.setTeamWizardSubteamMembers, setTeamWizardSubteamMembers)
  Container.listenAction(TeamsGen.finishNewTeamWizard, finishNewTeamWizard)
  Container.listenAction(TeamsGen.finishedNewTeamWizard, finishedNewTeamWizard)

  // Add members wizard
  Container.listenAction(TeamsGen.startAddMembersWizard, startAddMembersWizard)
  Container.listenAction(TeamsGen.addMembersWizardPushMembers, addMembersWizardPushMembers)
  Container.listenAction(
    [TeamsGen.cancelAddMembersWizard, TeamsGen.finishedAddMembersWizard],
    navAwayFromAddMembersWizard
  )

  Container.listenAction(TeamsGen.teamSeen, teamSeen)
  Container.listenAction(RouteTreeGen.onNavChanged, maybeClearBadges)

  // Channels list + page
  Container.listenAction(TeamsGen.loadTeamChannelList, loadTeamChannelList)

  // Hook up the team building sub saga
  commonListenActions('teams')
  Container.listenAction(
    TeamBuildingGen.finishTeamBuilding,
    filterForNs('teams', addThemToTeamFromTeamBuilder)
  )
  Container.listenAction(TeamsGen.addedToTeam, closeTeamBuilderOrSetError)
}

export default initTeams

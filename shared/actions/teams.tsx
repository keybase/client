/// TODO the relationships here are often inverted. we want to clear actions when a bunch of actions happen
// not have every handler clear it themselves. this reduces the nubmer of actionChains
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
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import * as RouteTreeGen from './route-tree-gen'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'
import * as Chat2Gen from './chat2-gen'
import * as GregorGen from './gregor-gen'
import * as Router2Constants from '../constants/router2'
import commonTeamBuildingSaga, {filterForNs} from './team-building'
import {uploadAvatarWaitingKey} from '../constants/profile'
import openSMS from '../util/sms'
import {convertToError, logError} from '../util/errors'
import {TypedState, TypedActions, isMobile} from '../util/container'
import {mapGetEnsureValue} from '../util/map'
import {RPCError} from '../util/errors'
import flags from '../util/feature-flags'
import {appendNewTeamBuilder} from './typed-routes'

async function createNewTeam(action: TeamsGen.CreateNewTeamPayload) {
  const {fromChat, joinSubteam, teamname, thenAddMembers} = action.payload
  try {
    const {teamID} = await RPCTypes.teamsTeamCreateRpcPromise(
      {joinSubteam, name: teamname},
      Constants.teamCreationWaitingKey
    )

    const addMembers = thenAddMembers ? [TeamsGen.createAddToTeam({...thenAddMembers, teamID})] : []
    return [TeamsGen.createTeamCreated({fromChat: !!fromChat, teamID, teamname}), ...addMembers]
  } catch (error) {
    return TeamsGen.createSetTeamCreationError({error: error.desc})
  }
}
const showTeamAfterCreation = (action: TeamsGen.TeamCreatedPayload) => {
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
    ...(isMobile
      ? []
      : [
          RouteTreeGen.createNavigateAppend({
            path: [{props: {createdTeam: true, teamID}, selected: 'profileEditAvatar'}],
          }),
        ]),
  ]
}

const openInviteLink = (_: TeamsGen.OpenInviteLinkPayload) => {
  return RouteTreeGen.createNavigateAppend({
    path: ['teamInviteLinkJoin'],
  })
}
const promptInviteLinkJoin = (deeplink: boolean) => (
  params: RPCTypes.MessageTypes['keybase.1.teamsUi.confirmInviteLinkAccept']['inParam'],
  response: {result: (boolean) => void}
) => {
  return Saga.callUntyped(function*() {
    yield Saga.put(TeamsGen.createUpdateInviteLinkDetails({details: params.details}))
    if (!deeplink) {
      yield Saga.put(
        RouteTreeGen.createNavigateAppend({
          path: [{props: params, selected: 'teamInviteLinkJoin'}],
          replace: true,
        })
      )
    }
    const action: TeamsGen.RespondToInviteLinkPayload = yield Saga.take(TeamsGen.respondToInviteLink)
    response.result(action.payload.accept)
  })
}
function* joinTeam(_: TypedState, action: TeamsGen.JoinTeamPayload) {
  const {teamname, deeplink} = action.payload

  /*
    In the deeplink flow, a modal is displayed which runs `joinTeam` (or an
    alternative flow, but we're not concerned with that here). In that case,
    we can fully manage the UX from inside of this handler.

    In the "Join team" flow, user pastes their link into the input box, which
    then calls `joinTeam` on its own. Since we need to switch to another modal,
    we simply plumb `deeplink` into the `promptInviteLinkJoin` handler and
    do the nav in the modal.
  */

  yield Saga.all([
    Saga.put(TeamsGen.createSetTeamJoinError({error: ''})),
    Saga.put(TeamsGen.createSetTeamJoinSuccess({open: false, success: false, teamname: ''})),
  ])
  try {
    const result = yield RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.teamsUi.confirmInviteLinkAccept': promptInviteLinkJoin(deeplink || false),
      },
      incomingCallMap: {},
      params: {tokenOrName: teamname},
      waitingKey: Constants.joinTeamWaitingKey,
    })

    // Success
    yield Saga.put(
      TeamsGen.createSetTeamJoinSuccess({
        open: result?.wasOpenTeam,
        success: true,
        teamname: result && result.wasTeamName ? teamname : '',
      })
    )
  } catch (error) {
    const desc =
      error.code === RPCTypes.StatusCode.scteaminvitebadtoken
        ? 'Sorry, that team name or token is not valid.'
        : error.code === RPCTypes.StatusCode.scnotfound
        ? 'This invitation is no longer valid, or has expired.'
        : error.desc
    yield Saga.put(TeamsGen.createSetTeamJoinError({error: desc}))
  }
}
const requestInviteLinkDetails = async (state: TypedState, _: TeamsGen.RequestInviteLinkDetailsPayload) => {
  try {
    const details = await RPCTypes.teamsGetInviteLinkDetailsRpcPromise({
      inviteID: state.teams.teamInviteDetails.inviteID,
    })
    return TeamsGen.createUpdateInviteLinkDetails({
      details,
    })
  } catch (error) {
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

const getTeamProfileAddList = async (action: TeamsGen.GetTeamProfileAddListPayload) => {
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

function* deleteTeam(_: TypedState, action: TeamsGen.DeleteTeamPayload, logger: Saga.SagaLogger) {
  try {
    yield RPCTypes.teamsTeamDeleteRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.teamsUi.confirmRootTeamDelete': (_, response) => response.result(true),
        'keybase.1.teamsUi.confirmSubteamDelete': (_, response) => response.result(true),
      },
      incomingCallMap: {},
      params: {
        teamID: action.payload.teamID,
      },
      waitingKey: Constants.deleteTeamWaitingKey(action.payload.teamID),
    })
  } catch (e) {
    // handled through waiting store
    logger.warn('error:', e.message)
  }
}
const leaveTeam = async (action: TeamsGen.LeaveTeamPayload, logger: Saga.SagaLogger) => {
  const {context, teamname, permanent} = action.payload
  logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
  try {
    await RPCTypes.teamsTeamLeaveRpcPromise(
      {name: teamname, permanent},
      Constants.leaveTeamWaitingKey(teamname)
    )
    logger.info(`leaveTeam: left ${teamname} successfully`)
    return TeamsGen.createLeftTeam({context, teamname})
  } catch (e) {
    // handled through waiting store
    logger.warn('error:', e.message)
    return
  }
}

const leftTeam = () => RouteTreeGen.createNavUpToScreen({routeName: 'teamsRoot'})

const loadWelcomeMessage = async (action: TeamsGen.LoadWelcomeMessagePayload, logger: Saga.SagaLogger) => {
  const {teamID} = action.payload
  try {
    const message = await RPCChatTypes.localGetWelcomeMessageRpcPromise(
      {teamID},
      Constants.loadWelcomeMessageWaitingKey(teamID)
    )
    return TeamsGen.createLoadedWelcomeMessage({message, teamID})
  } catch (error) {
    logger.error(error)
    return TeamsGen.createSettingsError({error: error.desc})
  }
}

const setWelcomeMessage = async (action: TeamsGen.SetWelcomeMessagePayload, logger: Saga.SagaLogger) => {
  const {message, teamID} = action.payload
  try {
    await RPCChatTypes.localSetWelcomeMessageRpcPromise(
      {message, teamID},
      Constants.setWelcomeMessageWaitingKey(teamID)
    )
    return TeamsGen.createLoadWelcomeMessage({teamID})
  } catch (error) {
    logger.error(error)
    return TeamsGen.createSetWelcomeMessageError({error: error.desc})
  }
}

const getTeamRetentionPolicy = async (
  action: TeamsGen.GetTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
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
    } catch (err) {
      logger.error(err.message)
      throw err
    }
  } catch (_) {}
  return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamID})
}

const saveTeamRetentionPolicy = (
  action: TeamsGen.SaveTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {teamID, policy} = action.payload

  let servicePolicy: RPCChatTypes.RetentionPolicy
  try {
    servicePolicy = Constants.retentionPolicyToServiceRetentionPolicy(policy)
  } catch (error) {
    logger.error(error.message)
    return TeamsGen.createSettingsError({error: error.desc})
  }
  return RPCChatTypes.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
    Constants.teamWaitingKey(teamID),
    Constants.retentionWaitingKey(teamID),
  ])
}

const updateTeamRetentionPolicy = (
  action: Chat2Gen.UpdateTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {metas} = action.payload
  const first = metas[0]
  if (!first) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetentionPolicy, teamID} = first
  try {
    return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy: teamRetentionPolicy, teamID})
  } catch (err) {
    logger.error(err.message)
    throw err
  }
}

function* inviteByEmail(_: TypedState, action: TeamsGen.InviteToTeamByEmailPayload, logger: Saga.SagaLogger) {
  const {invitees, role, teamID, teamname, loadingKey} = action.payload
  if (loadingKey) {
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
  }
  try {
    const res: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamAddEmailsBulkRpcPromise> = yield RPCTypes.teamsTeamAddEmailsBulkRpcPromise(
      {
        emails: invitees,
        name: teamname,
        role: (role ? RPCTypes.TeamRole[role] : RPCTypes.TeamRole.none) as any,
      },
      [Constants.teamWaitingKey(teamID), Constants.addToTeamByEmailWaitingKey(teamname)]
    )
    if (res.malformed && res.malformed.length > 0) {
      const malformed = res.malformed
      logger.warn(`teamInviteByEmail: Unable to parse ${malformed.length} email addresses`)
      yield Saga.put(
        TeamsGen.createSetEmailInviteError({
          malformed,
          // mobile can only invite one at a time, show bad email in error message
          message: isMobile
            ? `Error parsing email: ${malformed[0]}`
            : `There was an error parsing ${malformed.length} address${malformed.length > 1 ? 'es' : ''}.`,
        })
      )
    } else {
      // no malformed emails, assume everything went swimmingly
      yield Saga.put(
        TeamsGen.createSetEmailInviteError({
          malformed: [],
          message: '',
        })
      )
      if (!isMobile) {
        // mobile does not nav away
        yield Saga.put(RouteTreeGen.createClearModals())
      }
    }
  } catch (err) {
    // other error. display messages and leave all emails in input box
    yield Saga.put(TeamsGen.createSetEmailInviteError({malformed: [], message: err.desc}))
  } finally {
    if (loadingKey) {
      yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
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

const addToTeam = async (action: TeamsGen.AddToTeamPayload) => {
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
  } catch (err) {
    // If all of the users couldn't be added due to contact settings, the RPC fails.
    if (err.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      const users = err.fields?.filter((elem: any) => elem.key === 'usernames').map((elem: any) => elem.value)
      const usernames = users[0].split(',')
      return [
        TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {source: 'teamAddAllFailed', usernames}, selected: 'contactRestricted'}],
        }),
      ]
    }
    // TODO this should not error on member already in team
    return TeamsGen.createAddedToTeam({error: err.desc, fromTeamBuilder})
  }
}

const closeTeamBuilderOrSetError = (action: TeamsGen.AddedToTeamPayload) => {
  const {error, fromTeamBuilder} = action.payload
  if (!fromTeamBuilder) {
    return
  }
  return error
    ? TeamBuildingGen.createSetError({error, namespace: 'teams'})
    : TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'})
}

const reAddToTeam = async (action: TeamsGen.ReAddToTeamPayload) => {
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
  } catch (e) {
    return addReAddErrorHandler(username, e)
  }
}

const editDescription = async (action: TeamsGen.EditTeamDescriptionPayload) => {
  const {teamID, description} = action.payload
  try {
    await RPCTypes.teamsSetTeamShowcaseRpcPromise({description, teamID}, Constants.teamWaitingKey(teamID))
  } catch (e) {
    return TeamsGen.createSetEditDescriptionError({error: e.message})
  }
  return []
}

const uploadAvatar = async (action: TeamsGen.UploadTeamAvatarPayload, logger: Saga.SagaLogger) => {
  const {crop, filename, sendChatNotification, teamname} = action.payload
  try {
    await RPCTypes.teamsUploadTeamAvatarRpcPromise(
      {crop, filename, sendChatNotification, teamname},
      uploadAvatarWaitingKey
    )
    return RouteTreeGen.createNavigateUp()
  } catch (e) {
    // error displayed in component
    logger.warn(`Error uploading team avatar: ${e.message}`)
    return false
  }
}

const editMembership = async (action: TeamsGen.EditMembershipPayload) => {
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
  } catch (e) {
    // TODO fix
    // return TeamsGen.createSetEditMemberError({error: e.message, teamID, username})
  }
  return false
}

function* removeMember(_: TypedState, action: TeamsGen.RemoveMemberPayload, logger: Saga.SagaLogger) {
  const {teamID, username} = action.payload
  try {
    yield RPCTypes.teamsTeamRemoveMemberRpcPromise(
      {
        member: {
          assertion: {
            assertion: username,
            removeFromSubtree: false,
          },
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

function* removePendingInvite(
  _: TypedState,
  action: TeamsGen.RemovePendingInvitePayload,
  logger: Saga.SagaLogger
) {
  const {teamID, inviteID} = action.payload
  try {
    yield RPCTypes.teamsTeamRemoveMemberRpcPromise(
      {
        member: {
          inviteid: {
            inviteID,
          },
          type: RPCTypes.TeamMemberToRemoveType.inviteid,
        },
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
  let team
  const teamOrSubteam = teamname.includes('.') ? 'subteam' : 'team'
  if (teamname.length <= 33) {
    team = `${teamname} ${teamOrSubteam}`
  } else {
    team = `..${teamname.substring(teamname.length - 30)} subteam`
  }
  return `Join the ${team} on Keybase. Copy this message into the "Teams" tab.\n\ntoken: ${seitan.toLowerCase()}\n\ninstall: keybase.io/_/go`
}

function* inviteToTeamByPhone(
  _: TypedState,
  action: TeamsGen.InviteToTeamByPhonePayload,
  logger: Saga.SagaLogger
) {
  const {teamID, teamname, role, phoneNumber, fullName = '', loadingKey} = action.payload
  if (loadingKey) {
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
  }
  try {
    const seitan: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise> = yield RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise(
      {
        label: {sms: {f: fullName || '', n: phoneNumber} as RPCTypes.SeitanKeyLabelSms, t: 1},
        role: (!!role && RPCTypes.TeamRole[role]) || RPCTypes.TeamRole.none,
        teamname: teamname,
      },
      [Constants.teamWaitingKey(teamID)]
    )
    /* Open SMS */
    const bodyText = generateSMSBody(teamname, seitan)
    yield openSMS([phoneNumber], bodyText)
    if (loadingKey) {
      return TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname})
    }
    return false
  } catch (err) {
    logger.info('Error sending SMS', err)
    if (loadingKey) {
      yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
    }
    return false
  }
}

const ignoreRequest = async (action: TeamsGen.IgnoreRequestPayload) => {
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

async function createNewTeamFromConversation(
  state: TypedState,
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

const loadTeam = async (state: TypedState, action: TeamsGen.LoadTeamPayload, logger: Saga.SagaLogger) => {
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
  } catch (e) {
    logger.error(e.message)
    return
  }
}

function* addUserToTeams(state: TypedState, action: TeamsGen.AddUserToTeamsPayload, logger: Saga.SagaLogger) {
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
      yield RPCTypes.teamsTeamAddMemberRpcPromise(
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
  yield Saga.put(
    TeamsGen.createSetAddUserToTeamsResults({
      error: errorAddingTo.length > 0,
      results: result,
    })
  )
}

function* getTeams(
  state: TypedState,
  action: ConfigGen.LoadOnStartPayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload,
  logger: Saga.SagaLogger
) {
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
    const results: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamListUnverifiedRpcPromise> = yield RPCTypes.teamsTeamListUnverifiedRpcPromise(
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

    yield Saga.put(
      TeamsGen.createSetTeamInfo({
        teamMeta: Constants.teamListToMeta(teams),
        teamNameToID,
        teamnames: teamNameSet,
      })
    )
  } catch (err) {
    if (err.code === RPCTypes.StatusCode.scapinetworkerror) {
      // Ignore API errors due to offline
    } else {
      logger.error(err)
    }
  }
}

const getActivityForTeams = async (_: TeamsGen.GetActivityForTeamsPayload, logger: Saga.SagaLogger) => {
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
  const teams = (result || []).map(row => (row && row.parts ? row.parts.join('.') : ''))
  return TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: new Set<Types.Teamname>(teams)})
}

const _joinConversation = function*(
  teamID: Types.TeamID,
  waitingKey: string,
  conversationIDKey: ChatTypes.ConversationIDKey
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield RPCChatTypes.localJoinConversationByIDLocalRpcPromise({convID}, waitingKey)
    yield Saga.put(
      TeamsGen.createAddParticipant({
        conversationIDKey,
        teamID,
      })
    )
  } catch (error) {
    yield Saga.put(ConfigGen.createGlobalError({globalError: convertToError(error)}))
  }
}

const _leaveConversation = function*(
  teamID: Types.TeamID,
  waitingKey: string,
  conversationIDKey: ChatTypes.ConversationIDKey
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield RPCChatTypes.localLeaveConversationLocalRpcPromise({convID}, waitingKey)
    yield Saga.put(TeamsGen.createRemoveParticipant({conversationIDKey, teamID}))
  } catch (error) {
    yield Saga.put(ConfigGen.createGlobalError({globalError: convertToError(error)}))
  }
}

function* saveChannelMembership(_: TypedState, action: TeamsGen.SaveChannelMembershipPayload) {
  const {teamID, oldChannelState, newChannelState} = action.payload
  const waitingKey = Constants.teamWaitingKey(teamID)

  const calls: Array<any> = []
  for (const convIDKeyStr in newChannelState) {
    const convIDKey = ChatTypes.stringToConversationIDKey(convIDKeyStr)
    if (oldChannelState[convIDKey] === newChannelState[convIDKey]) {
      continue
    }

    if (newChannelState[convIDKey]) {
      calls.push(Saga.callUntyped(_joinConversation, teamID, waitingKey, convIDKey))
    } else {
      calls.push(Saga.callUntyped(_leaveConversation, teamID, waitingKey, convIDKey))
    }
  }

  yield Saga.all(calls)
}

function* createChannel(state: TypedState, action: TeamsGen.CreateChannelPayload, logger: Saga.SagaLogger) {
  const {channelname, description, teamID} = action.payload
  const teamname = Constants.getTeamNameFromID(state, teamID)

  if (teamname === null) {
    logger.warn('Team name was not in store!')
    return
  }

  try {
    const result: Saga.RPCPromiseType<typeof RPCChatTypes.localNewConversationLocalRpcPromise> = yield RPCChatTypes.localNewConversationLocalRpcPromise(
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
      yield RPCChatTypes.localPostHeadlineNonblockRpcPromise(
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
    if (visibleScreen && visibleScreen.routeName === 'chatCreateChannel') {
      yield Saga.put(RouteTreeGen.createClearModals())
    }

    // Select the new channel, and switch to the chat tab.
    if (action.payload.navToChatOnSuccess) {
      yield Saga.put(
        Chat2Gen.createPreviewConversation({
          channelname,
          conversationIDKey: newConversationIDKey,
          reason: 'newChannel',
          teamname,
        })
      )
    } else {
      yield Saga.put(TeamsGen.createLoadTeamChannelList({teamID}))
    }
  } catch (error) {
    yield Saga.put(TeamsGen.createSetChannelCreationError({error: error.desc}))
  }
}

const createChannels = async (state: TypedState, action: TeamsGen.CreateChannelsPayload) => {
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
    return TeamsGen.createSetChannelCreationError({error: error.desc})
  }
  return TeamsGen.createSetCreatingChannels({creatingChannels: false})
}

const setMemberPublicity = async (action: TeamsGen.SetMemberPublicityPayload) => {
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
    return TeamsGen.createSettingsError({error: error.desc})
  }
}

function* setPublicity(state: TypedState, action: TeamsGen.SetPublicityPayload) {
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

  const calls: Array<any> = []
  if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
    calls.push(
      Saga.callUntyped(async () => {
        try {
          const payload = await RPCTypes.teamsTeamSetSettingsRpcPromise(
            {
              settings: {
                joinAs: RPCTypes.TeamRole[settings.openTeamRole],
                open: settings.openTeam,
              },
              teamID,
            },
            waitingKey
          )
          return {payload, type: 'ok'}
        } catch (payload) {
          return {payload, type: 'error'}
        }
      })
    )
  }
  if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
    calls.push(
      Saga.callUntyped(async () => {
        try {
          const payload = await RPCTypes.teamsSetTarsDisabledRpcPromise(
            {disabled: settings.ignoreAccessRequests, teamID},
            waitingKey
          )
          return {payload, type: 'ok'}
        } catch (payload) {
          return {payload, type: 'error'}
        }
      })
    )
  }
  if (publicityAnyMember !== settings.publicityAnyMember) {
    calls.push(
      Saga.callUntyped(async () => {
        try {
          const payload = await RPCTypes.teamsSetTeamShowcaseRpcPromise(
            {anyMemberShowcase: settings.publicityAnyMember, teamID},
            waitingKey
          )
          return {payload, type: 'ok'}
        } catch (payload) {
          return {payload, type: 'error'}
        }
      })
    )
  }
  if (publicityMember !== settings.publicityMember) {
    calls.push(
      Saga.callUntyped(async () => {
        try {
          const payload = await RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
            {isShowcased: settings.publicityMember, teamID},
            waitingKey
          )
          return {payload, type: 'ok'}
        } catch (payload) {
          return {payload, type: 'error'}
        }
      })
    )
  }
  if (publicityTeam !== settings.publicityTeam) {
    calls.push(
      Saga.callUntyped(async () => {
        try {
          const payload = await RPCTypes.teamsSetTeamShowcaseRpcPromise(
            {isShowcased: settings.publicityTeam, teamID},
            waitingKey
          )
          return {payload, type: 'ok'}
        } catch (payload) {
          return {payload, type: 'error'}
        }
      })
    )
  }

  // TODO fix type
  const results: any = yield Saga.all(calls)

  // Display any errors from the rpcs
  const errs = results
    .filter((r: any) => r.type === 'error')
    .map(({payload}: any) => Saga.put(ConfigGen.createGlobalError({globalError: convertToError(payload)})))
  yield Saga.all(errs)
}

const teamChangedByID = (state: TypedState, action: EngineGen.Keybase1NotifyTeamTeamChangedByIDPayload) => {
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
  action: EngineGen.Keybase1NotifyTeamTeamRoleMapChangedPayload
) => {
  const {newVersion} = action.payload.params
  return TeamsGen.createSetTeamRoleMapLatestKnownVersion({version: newVersion})
}

const refreshTeamRoleMap = async (
  state: TypedState,
  action: EngineGen.Keybase1NotifyTeamTeamRoleMapChangedPayload | ConfigGen.BootstrapStatusLoadedPayload,
  logger: Saga.SagaLogger
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

const teamDeletedOrExit = (
  action: EngineGen.Keybase1NotifyTeamTeamDeletedPayload | EngineGen.Keybase1NotifyTeamTeamExitPayload
) => {
  const {teamID} = action.payload.params
  const selectedTeams = Constants.getSelectedTeams()
  if (selectedTeams.includes(teamID)) {
    return RouteTreeGen.createNavUpToScreen({routeName: 'teamsRoot'})
  }
  return false
}

const reloadTeamListIfSubscribed = (state: TypedState, _: unknown, logger: Saga.SagaLogger) => {
  if (state.teams.teamMetaSubscribeCount > 0) {
    logger.info('eagerly reloading')
    return TeamsGen.createGetTeams()
  } else {
    logger.info('skipping')
  }
  return false
}

const updateTopic = async (state: TypedState, action: TeamsGen.UpdateTopicPayload) => {
  const {teamID, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: Constants.getTeamNameFromID(state, teamID) ?? '',
    tlfPublic: false,
  }

  await RPCChatTypes.localPostHeadlineRpcPromise(param, Constants.updateChannelNameWaitingKey(teamID))
  if (!flags.teamsRedesign) {
    return RouteTreeGen.createNavUpToScreen({routeName: 'chatManageChannels'})
  }
  return []
}

function* addTeamWithChosenChannels(
  state: TypedState,
  action: TeamsGen.AddTeamWithChosenChannelsPayload,
  logger: Saga.SagaLogger
) {
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
  let pushState: Saga.RPCPromiseType<typeof RPCTypes.gregorGetStateRpcPromise>
  try {
    pushState = yield RPCTypes.gregorGetStateRpcPromise(undefined, Constants.teamWaitingKey(teamID))
  } catch (err) {
    // failure getting the push state, don't bother the user with an error
    // and don't try to move forward updating the state
    logger.error(`${logPrefix} error fetching gregor state: ${err}`)
    return
  }
  const item =
    pushState.items &&
    pushState.items.find(i => i.item && i.item.category === Constants.chosenChannelsGregorKey)
  let teams: Array<string> = []
  let msgID
  if (item && item.item && item.item.body) {
    const body = item.item.body
    msgID = item.md && item.md.msgID
    teams = JSON.parse(body.toString())
  } else {
    logger.info(
      `${logPrefix} No item in gregor state found, making new item. Total # of items: ${(pushState.items &&
        pushState.items.length) ||
        0}`
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
  yield RPCTypes.gregorUpdateCategoryRpcPromise(
    {
      body: JSON.stringify(teams),
      category: Constants.chosenChannelsGregorKey,
      dtime,
    },
    teams.map(t => Constants.teamWaitingKey(Constants.getTeamID(state, t)))
  )
}

const updateChannelname = async (state: TypedState, action: TeamsGen.UpdateChannelNamePayload) => {
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
    return TeamsGen.createSetChannelCreationError({error: error.desc})
  }
}

const deleteChannelConfirmed = async (action: TeamsGen.DeleteChannelConfirmedPayload) => {
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

const deleteMultiChannelsConfirmed = async (action: TeamsGen.DeleteMultiChannelsConfirmedPayload) => {
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

  return false
}

const getMembers = async (action: TeamsGen.GetMembersPayload, logger: Saga.SagaLogger) => {
  const {teamID} = action.payload
  try {
    const res = await RPCTypes.teamsTeamGetMembersByIDRpcPromise({
      id: teamID,
    })
    const members = Constants.rpcDetailsToMemberInfos(res ?? [])
    return TeamsGen.createSetMembers({members, teamID})
  } catch (error) {
    logger.error(`Error updating members for ${teamID}: ${error.desc}`)
    return false
  }
}

const badgeAppForTeams = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    // Don't make any calls we don't have permission to.
    return
  }
  const {badgeState} = action.payload

  const actions: Array<TypedActions> = []
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

const gregorPushState = (action: GregorGen.PushStatePayload) => {
  const actions: Array<TypedActions> = []
  const items = action.payload.state
  let sawChatBanner = false
  let sawSubteamsBanner = false
  let chosenChannels: any
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
      const body = i.item.body.toString()
      if (body) {
        const request: {id: Types.TeamID; username: string} = JSON.parse(body)
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

  const teamsWithChosenChannelsStr: string | undefined = chosenChannels?.item.body.toString()
  const teamsWithChosenChannels = teamsWithChosenChannelsStr
    ? new Set<Types.Teamname>(JSON.parse(teamsWithChosenChannelsStr))
    : new Set<Types.Teamname>()
  actions.push(TeamsGen.createSetTeamsWithChosenChannels({teamsWithChosenChannels}))

  return actions
}

const renameTeam = async (action: TeamsGen.RenameTeamPayload) => {
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
  state: TypedState,
  {payload: {teamID}}: TeamBuildingGen.FinishTeamBuildingPayload,
  logger: Saga.SagaLogger
) {
  if (!teamID) {
    logger.error("Trying to add them to a team, but I don't know what the teamID is.")
    return
  }
  if (flags.teamsRedesign) {
    return [
      TeamBuildingGen.createFinishedTeamBuilding({namespace: 'teams'}),
      TeamsGen.createAddMembersWizardPushMembers({
        members: [...state.teams.teamBuilding.teamSoFar].map(user => ({assertion: user.id, role: 'writer'})),
      }),
    ]
  }

  const role = state.teams.teamBuilding.selectedRole
  const sendChatNotification = state.teams.teamBuilding.sendNotification

  const users = [...state.teams.teamBuilding.teamSoFar].map(user => ({assertion: user.id, role}))
  return TeamsGen.createAddToTeam({
    fromTeamBuilder: true,
    sendChatNotification,
    teamID,
    users,
  })
}

function* teamBuildingSaga() {
  yield* commonTeamBuildingSaga('teams')

  yield* Saga.chainAction2(
    TeamBuildingGen.finishTeamBuilding,
    filterForNs('teams', addThemToTeamFromTeamBuilder)
  )
  yield* Saga.chainAction(TeamsGen.addedToTeam, closeTeamBuilderOrSetError)
}

async function showTeamByName(action: TeamsGen.ShowTeamByNamePayload, logger: Saga.SagaLogger) {
  const {teamname, initialTab, addMembers, join} = action.payload
  let teamID: string
  try {
    teamID = await RPCTypes.teamsGetTeamIDRpcPromise({teamName: teamname})
  } catch (err) {
    logger.info(`team="${teamname}" cannot be loaded:`, err)
    if (flags.teamsRedesign) {
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
    return null
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
const loadTeamTree = async (action: TeamsGen.LoadTeamTreePayload, _logger: Saga.SagaLogger) => {
  await RPCTypes.teamsLoadTeamTreeMembershipsAsyncRpcPromise(action.payload)
}

const loadTeamTreeActivity = async (
  action: EngineGen.Keybase1NotifyTeamTeamTreeMembershipsPartialPayload,
  logger: Saga.SagaLogger
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
  } catch (e) {
    logger.info(`loadTeamTreeActivity: unable to get activity for ${teamID}:${username}: ${e.message}`)
    return null
  }
}

const launchNewTeamWizardOrModal = (action: TeamsGen.LaunchNewTeamWizardOrModalPayload) => {
  if (flags.teamsRedesign) {
    if (action.payload.subteamOf) {
      return RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard2TeamInfo'}]})
    }
    return TeamsGen.createStartNewTeamWizard()
  } else {
    return RouteTreeGen.createNavigateAppend({
      path: [{props: {subteamOf: action.payload.subteamOf}, selected: 'teamNewTeamDialog'}],
    })
  }
}
const startNewTeamWizard = () =>
  RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard1TeamPurpose'}]})
const setTeamWizardTeamType = () =>
  RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard2TeamInfo'}]})
const setTeamWizardNameDescription = () =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {createdTeam: true, teamID: Types.newTeamWizardTeamID, wizard: true},
        selected: 'profileEditAvatar',
      },
    ],
  })
const setTeamWizardAvatar = (state: TypedState) => {
  switch (state.teams.newTeamWizard.teamType) {
    case 'subteam':
      return RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizardSubteamMembers'}]})
    case 'friends':
    case 'other':
      return TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
    case 'project':
      return RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard5Channels'}]})
    case 'community':
      return RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard4TeamSize'}]})
  }
}
const setTeamWizardSubteamMembers = () => RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamConfirm']})
const setTeamWizardTeamSize = (action: TeamsGen.SetTeamWizardTeamSizePayload) =>
  action.payload.isBig
    ? RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard5Channels'}]})
    : TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
const setTeamWizardChannels = () =>
  RouteTreeGen.createNavigateAppend({path: [{selected: 'teamWizard6Subteams'}]})
const setTeamWizardSubteams = () => TeamsGen.createStartAddMembersWizard({teamID: Types.newTeamWizardTeamID})
const startAddMembersWizard = (action: TeamsGen.StartAddMembersWizardPayload) =>
  flags.teamsRedesign
    ? RouteTreeGen.createNavigateAppend({
        path: ['teamAddToTeamFromWhere'],
      })
    : appendNewTeamBuilder(action.payload.teamID)
const finishNewTeamWizard = async (state: TypedState) => {
  const {name, description, open, openTeamJoinRole, showcase, addYourself} = state.teams.newTeamWizard
  const {avatarFilename, avatarCrop, channels, subteams} = state.teams.newTeamWizard
  const teamInfo: RPCTypes.TeamCreateFancyInfo = {
    avatar: avatarFilename ? {avatarFilename, crop: avatarCrop?.crop} : null,
    chatChannels: channels,
    description,
    joinSubteam: addYourself,
    name,
    openSettings: {joinAs: RPCTypes.TeamRole[openTeamJoinRole], open},
    showcase,
    subteams,
    users: state.teams.addMembersWizard.addingMembers.map(member => ({
      assertion: member.assertion,
      role: RPCTypes.TeamRole[member.role],
    })),
  }
  try {
    const teamID = await RPCTypes.teamsTeamCreateFancyRpcPromise({teamInfo}, Constants.teamCreationWaitingKey)
    return TeamsGen.createFinishedNewTeamWizard({teamID})
  } catch (e) {
    return TeamsGen.createSetTeamWizardError({error: e.message})
  }
}

const finishedNewTeamWizard = (action: TeamsGen.FinishedNewTeamWizardPayload) => [
  RouteTreeGen.createClearModals(),
  RouteTreeGen.createNavigateAppend({path: [{props: {teamID: action.payload.teamID}, selected: 'team'}]}),
]

const addMembersWizardPushMembers = () => RouteTreeGen.createNavigateAppend({path: ['teamAddToTeamConfirm']})
const navAwayFromAddMembersWizard = () => RouteTreeGen.createClearModals()

const manageChatChannels = (action: TeamsGen.ManageChatChannelsPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {teamID: action.payload.teamID},
        selected: flags.teamsRedesign ? 'teamAddToChannels' : 'chatManageChannels',
      },
    ],
  })

const teamSeen = async (action: TeamsGen.TeamSeenPayload, logger: Saga.SagaLogger) => {
  const {teamID} = action.payload
  try {
    await RPCTypes.gregorDismissCategoryRpcPromise({category: Constants.newRequestsGregorKey(teamID)})
  } catch (e) {
    logger.error(e.message)
  }
}

const maybeClearBadges = (action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  if (prev[2]?.routeName === Tabs.teamsTab && next[2]?.routeName !== Tabs.teamsTab) {
    return TeamsGen.createClearNavBadges()
  }
  return false
}

const loadTeamChannelList = async (
  state: TypedState,
  action: TeamsGen.LoadTeamChannelListPayload,
  logger
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
      ;[...channels.values()].forEach(
        async ({conversationIDKey}) =>
          await RPCChatTypes.localRefreshParticipantsRpcPromise({
            convID: ChatTypes.keyToConversationID(conversationIDKey),
          })
      )
    } catch (e) {
      logger.error('this should never happen', e)
    }

    return TeamsGen.createTeamChannelListLoaded({channels, teamID})
  } catch (err) {
    logger.warn(err)
  }
  return false
}

const teamsSaga = function*() {
  yield* Saga.chainAction(TeamsGen.leaveTeam, leaveTeam)
  yield* Saga.chainGenerator<TeamsGen.DeleteTeamPayload>(TeamsGen.deleteTeam, deleteTeam)
  yield* Saga.chainAction(TeamsGen.getTeamProfileAddList, getTeamProfileAddList)
  yield* Saga.chainAction2(TeamsGen.leftTeam, leftTeam)
  yield* Saga.chainAction(TeamsGen.createNewTeam, createNewTeam)
  yield* Saga.chainAction(TeamsGen.teamCreated, showTeamAfterCreation)

  yield* Saga.chainGenerator<TeamsGen.JoinTeamPayload>(TeamsGen.joinTeam, joinTeam)
  yield* Saga.chainAction(TeamsGen.openInviteLink, openInviteLink)
  yield* Saga.chainAction2(TeamsGen.requestInviteLinkDetails, requestInviteLinkDetails)

  yield* Saga.chainAction2(TeamsGen.loadTeam, loadTeam)
  yield* Saga.chainAction(TeamsGen.getMembers, getMembers)
  yield* Saga.chainAction2(TeamsGen.createNewTeamFromConversation, createNewTeamFromConversation)
  yield* Saga.chainGenerator<
    ConfigGen.LoadOnStartPayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload
  >([ConfigGen.loadOnStart, TeamsGen.getTeams, TeamsGen.leftTeam], getTeams)
  yield* Saga.chainAction(TeamsGen.getActivityForTeams, getActivityForTeams)
  yield* Saga.chainGenerator<TeamsGen.SaveChannelMembershipPayload>(
    TeamsGen.saveChannelMembership,
    saveChannelMembership
  )
  yield* Saga.chainAction2(
    [ConfigGen.bootstrapStatusLoaded, EngineGen.keybase1NotifyTeamTeamRoleMapChanged],
    refreshTeamRoleMap
  )

  yield* Saga.chainGenerator<TeamsGen.CreateChannelPayload>(TeamsGen.createChannel, createChannel)
  yield* Saga.chainAction(TeamsGen.addToTeam, addToTeam)
  yield* Saga.chainAction(TeamsGen.reAddToTeam, reAddToTeam)
  yield* Saga.chainGenerator<TeamsGen.AddUserToTeamsPayload>(TeamsGen.addUserToTeams, addUserToTeams)
  yield* Saga.chainGenerator<TeamsGen.InviteToTeamByEmailPayload>(TeamsGen.inviteToTeamByEmail, inviteByEmail)
  yield* Saga.chainAction(TeamsGen.ignoreRequest, ignoreRequest)
  yield* Saga.chainAction(TeamsGen.editTeamDescription, editDescription)
  yield* Saga.chainAction(TeamsGen.uploadTeamAvatar, uploadAvatar)
  yield* Saga.chainAction2(TeamsGen.createChannels, createChannels)
  yield* Saga.chainAction(TeamsGen.editMembership, editMembership)
  yield* Saga.chainGenerator<TeamsGen.RemoveMemberPayload>(TeamsGen.removeMember, removeMember)
  yield* Saga.chainGenerator<TeamsGen.RemovePendingInvitePayload>(
    TeamsGen.removePendingInvite,
    removePendingInvite
  )
  yield* Saga.chainAction(TeamsGen.setMemberPublicity, setMemberPublicity)
  yield* Saga.chainAction2(TeamsGen.updateTopic, updateTopic)
  yield* Saga.chainAction2(TeamsGen.updateChannelName, updateChannelname)
  yield* Saga.chainAction(TeamsGen.deleteChannelConfirmed, deleteChannelConfirmed)
  yield* Saga.chainAction(TeamsGen.deleteMultiChannelsConfirmed, deleteMultiChannelsConfirmed)
  yield* Saga.chainGenerator<TeamsGen.InviteToTeamByPhonePayload>(
    TeamsGen.inviteToTeamByPhone,
    inviteToTeamByPhone
  )
  yield* Saga.chainGenerator<TeamsGen.SetPublicityPayload>(TeamsGen.setPublicity, setPublicity)
  yield* Saga.chainAction2(TeamsGen.checkRequestedAccess, checkRequestedAccess)
  yield* Saga.chainAction(TeamsGen.getTeamRetentionPolicy, getTeamRetentionPolicy)
  yield* Saga.chainAction(TeamsGen.saveTeamRetentionPolicy, saveTeamRetentionPolicy)
  yield* Saga.chainAction(Chat2Gen.updateTeamRetentionPolicy, updateTeamRetentionPolicy)
  yield* Saga.chainGenerator<TeamsGen.AddTeamWithChosenChannelsPayload>(
    TeamsGen.addTeamWithChosenChannels,
    addTeamWithChosenChannels
  )
  yield* Saga.chainAction(TeamsGen.renameTeam, renameTeam)
  yield* Saga.chainAction(TeamsGen.manageChatChannels, manageChatChannels)
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, badgeAppForTeams)
  yield* Saga.chainAction(GregorGen.pushState, gregorPushState)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyTeamTeamChangedByID, teamChangedByID)
  yield* Saga.chainAction(
    EngineGen.keybase1NotifyTeamTeamRoleMapChanged,
    teamRoleMapChangedUpdateLatestKnownVersion
  )

  yield* Saga.chainAction(
    [EngineGen.keybase1NotifyTeamTeamDeleted, EngineGen.keybase1NotifyTeamTeamExit],
    teamDeletedOrExit
  )

  yield* Saga.chainAction2(
    [EngineGen.keybase1NotifyTeamTeamMetadataUpdate, GregorGen.updateReachable],
    reloadTeamListIfSubscribed
  )

  yield* Saga.chainAction2(TeamsGen.clearNavBadges, clearNavBadges)

  yield* Saga.chainAction(TeamsGen.showTeamByName, showTeamByName)

  yield* Saga.chainAction(TeamsGen.loadWelcomeMessage, loadWelcomeMessage)
  yield* Saga.chainAction(TeamsGen.setWelcomeMessage, setWelcomeMessage)

  yield* Saga.chainAction(TeamsGen.loadTeamTree, loadTeamTree)
  yield* Saga.chainAction(EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial, loadTeamTreeActivity)

  // New team wizard
  yield* Saga.chainAction(TeamsGen.launchNewTeamWizardOrModal, launchNewTeamWizardOrModal)
  yield* Saga.chainAction(TeamsGen.startNewTeamWizard, startNewTeamWizard)
  yield* Saga.chainAction(TeamsGen.setTeamWizardTeamType, setTeamWizardTeamType)
  yield* Saga.chainAction(TeamsGen.setTeamWizardNameDescription, setTeamWizardNameDescription)
  yield* Saga.chainAction2(TeamsGen.setTeamWizardAvatar, setTeamWizardAvatar)
  yield* Saga.chainAction(TeamsGen.setTeamWizardTeamSize, setTeamWizardTeamSize)
  yield* Saga.chainAction(TeamsGen.setTeamWizardChannels, setTeamWizardChannels)
  yield* Saga.chainAction(TeamsGen.setTeamWizardSubteams, setTeamWizardSubteams)
  yield* Saga.chainAction(TeamsGen.setTeamWizardSubteamMembers, setTeamWizardSubteamMembers)
  yield* Saga.chainAction2(TeamsGen.finishNewTeamWizard, finishNewTeamWizard)
  yield* Saga.chainAction(TeamsGen.finishedNewTeamWizard, finishedNewTeamWizard)

  // Add members wizard
  yield* Saga.chainAction(TeamsGen.startAddMembersWizard, startAddMembersWizard)
  yield* Saga.chainAction(TeamsGen.addMembersWizardPushMembers, addMembersWizardPushMembers)
  yield* Saga.chainAction(
    [TeamsGen.cancelAddMembersWizard, TeamsGen.finishedAddMembersWizard],
    navAwayFromAddMembersWizard
  )

  yield* Saga.chainAction(TeamsGen.teamSeen, teamSeen)
  yield* Saga.chainAction(RouteTreeGen.onNavChanged, maybeClearBadges)

  // Channels list + page
  yield* Saga.chainAction2(TeamsGen.loadTeamChannelList, loadTeamChannelList)

  // Hook up the team building sub saga
  yield* teamBuildingSaga()
}

export default teamsSaga

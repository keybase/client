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
import * as RouteTreeGen from './route-tree-gen'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'
import * as Chat2Gen from './chat2-gen'
import * as GregorGen from './gregor-gen'
import * as Tracker2Gen from './tracker2-gen'
import * as Router2Constants from '../constants/router2'
import commonTeamBuildingSaga, {filterForNs} from './team-building'
import {uploadAvatarWaitingKey} from '../constants/profile'
import openSMS from '../util/sms'
import {convertToError, logError} from '../util/errors'
import {TypedState, TypedActions, isMobile} from '../util/container'
import {mapGetEnsureValue} from '../util/map'

async function createNewTeam(_: TypedState, action: TeamsGen.CreateNewTeamPayload) {
  const {joinSubteam, teamname} = action.payload
  try {
    const res = await RPCTypes.teamsTeamCreateRpcPromise(
      {joinSubteam, name: teamname},
      Constants.teamCreationWaitingKey
    )

    return [
      RouteTreeGen.createClearModals(),
      RouteTreeGen.createNavigateAppend({path: [{props: {teamID: res.teamID}, selected: 'team'}]}),
      ...(isMobile
        ? []
        : [
            RouteTreeGen.createNavigateAppend({
              path: [{props: {createdTeam: true, teamname}, selected: 'teamEditTeamAvatar'}],
            }),
          ]),
    ]
  } catch (error) {
    return TeamsGen.createSetTeamCreationError({error: error.desc})
  }
}

function* joinTeam(_: TypedState, action: TeamsGen.JoinTeamPayload) {
  const {teamname} = action.payload
  yield Saga.all([
    Saga.put(TeamsGen.createSetTeamJoinError({error: ''})),
    Saga.put(TeamsGen.createSetTeamJoinSuccess({success: false, teamname: ''})),
  ])
  try {
    const result: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise> = yield Saga.callUntyped(
      RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise,
      {tokenOrName: teamname},
      Constants.teamWaitingKey(teamname)
    )

    // Success
    yield Saga.put(
      TeamsGen.createSetTeamJoinSuccess({
        success: true,
        teamname: result && result.wasTeamName ? teamname : '',
      })
    )
  } catch (error) {
    const desc =
      error.code === RPCTypes.StatusCode.scteaminvitebadtoken
        ? 'Sorry, that team name or token is not valid.'
        : error.desc
    yield Saga.put(TeamsGen.createSetTeamJoinError({error: desc}))
  }
}

const getTeamProfileAddList = async (_: TypedState, action: TeamsGen.GetTeamProfileAddListPayload) => {
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
const leaveTeam = async (_: TypedState, action: TeamsGen.LeaveTeamPayload, logger: Saga.SagaLogger) => {
  const {context, teamname} = action.payload
  logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
  try {
    await RPCTypes.teamsTeamLeaveRpcPromise(
      {name: teamname, permanent: false},
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

const getTeamRetentionPolicy = async (
  state: TypedState,
  action: TeamsGen.GetTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {teamname} = action.payload
  const teamID = Constants.getTeamID(state, teamname)
  if (teamID === Types.noTeamID) {
    const errMsg = `getTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    return
  }

  let retentionPolicy = Constants.makeRetentionPolicy()
  try {
    const policy = await RPCChatTypes.localGetTeamRetentionLocalRpcPromise(
      {teamID},
      Constants.teamWaitingKey(teamname)
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
  return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamname})
}

const saveTeamRetentionPolicy = (
  state: TypedState,
  action: TeamsGen.SaveTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {teamname, policy} = action.payload

  // get teamID
  const teamID = Constants.getTeamID(state, teamname)
  if (teamID === Types.noTeamID) {
    const errMsg = `saveTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  let servicePolicy: RPCChatTypes.RetentionPolicy
  try {
    servicePolicy = Constants.retentionPolicyToServiceRetentionPolicy(policy)
  } catch (err) {
    logger.error(err.message)
    throw err
  }
  return RPCChatTypes.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
    Constants.teamWaitingKey(teamname),
    Constants.retentionWaitingKey(teamname),
  ])
}

const updateTeamRetentionPolicy = (
  _: TypedState,
  action: Chat2Gen.UpdateTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {metas} = action.payload
  const first = metas[0]
  if (!first) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetentionPolicy, teamname} = first
  try {
    return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy: teamRetentionPolicy, teamname})
  } catch (err) {
    logger.error(err.message)
    throw err
  }
}

function* inviteByEmail(_: TypedState, action: TeamsGen.InviteToTeamByEmailPayload, logger: Saga.SagaLogger) {
  const {invitees, role, teamname, loadingKey} = action.payload
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
      [Constants.teamWaitingKey(teamname), Constants.addToTeamByEmailWaitingKey(teamname)]
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
    yield Saga.put(TeamsGen.createGetDetails({clearInviteLoadingKey: loadingKey, teamname}))
  } catch (err) {
    // other error. display messages and leave all emails in input box
    yield Saga.put(TeamsGen.createSetEmailInviteError({malformed: [], message: err.desc}))
    if (loadingKey) {
      yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
    }
  }
}

const addToTeamWaitingKeys = (teamname, username) => [
  Constants.teamWaitingKey(teamname),
  Constants.addMemberWaitingKey(teamname, username),
]

const addReAddErrorHandler = (username, e) => {
  // identify error
  if (e.code === RPCTypes.StatusCode.scidentifysummaryerror) {
    // show profile card
    return ProfileGen.createShowUserProfile({username})
  }
  return undefined
}

const addToTeam = async (state: TypedState, action: TeamsGen.AddToTeamPayload) => {
  const {teamID, users, sendChatNotification} = action.payload
  try {
    await RPCTypes.teamsTeamAddMembersMultiRoleRpcPromise(
      {
        sendChatNotification,
        teamID,
        users: users.map(({assertion, role}) => ({
          assertionOrEmail: assertion,
          role: RPCTypes.TeamRole[role],
        })),
      },
      Constants.addMemberWaitingKey(teamID, users.map(({assertion}) => assertion).join(',')) // TODO fix uses of this
    )
    return false
  } catch (e) {
    // TODO plumb to modal
    // return addReAddErrorHandler(username, e)
    return false
  }
}

const reAddToTeam = async (state: TypedState, action: TeamsGen.ReAddToTeamPayload) => {
  const {teamname, username} = action.payload
  const id = state.teams.teamNameToID.get(teamname) ?? ''
  if (!id) {
    throw new Error(`team ID not on file for team '${teamname}'`)
  }
  try {
    await RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise(
      {
        id,
        username,
      },
      addToTeamWaitingKeys(teamname, username)
    )
    return false
  } catch (e) {
    return addReAddErrorHandler(username, e)
  }
}

const editDescription = async (_: TypedState, action: TeamsGen.EditTeamDescriptionPayload) => {
  const {teamname, description} = action.payload
  try {
    await RPCTypes.teamsSetTeamShowcaseRpcPromise(
      {description, name: teamname},
      Constants.teamWaitingKey(teamname)
    )
    return TeamsGen.createGetDetails({teamname})
  } catch (__) {
    // TODO We don't get a team changed notification for this. Delete this call when CORE-7125 is finished.
    return TeamsGen.createGetDetails({teamname})
  }
}

const uploadAvatar = async (
  _: TypedState,
  action: TeamsGen.UploadTeamAvatarPayload,
  logger: Saga.SagaLogger
) => {
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

const editMembership = async (_: TypedState, action: TeamsGen.EditMembershipPayload) => {
  const {teamname, username, role} = action.payload
  await RPCTypes.teamsTeamEditMemberRpcPromise(
    {
      name: teamname,
      role: role ? RPCTypes.TeamRole[role] : RPCTypes.TeamRole.none,
      username,
    },
    Constants.teamWaitingKey(teamname)
  )
}

function* removeMemberOrPendingInvite(
  _: TypedState,
  action: TeamsGen.RemoveMemberOrPendingInvitePayload,
  logger: Saga.SagaLogger
) {
  const {teamname, username, email, inviteID, loadingKey} = action.payload
  if (loadingKey) {
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
  }
  // Disallow call with any pair of username, email, and ID to avoid black-bar
  // errors.
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  try {
    yield RPCTypes.teamsTeamRemoveMemberRpcPromise(
      {
        allowInaction: true,
        email,
        inviteID,
        name: teamname,
        username,
      },
      [
        Constants.teamWaitingKey(teamname),
        // only one of (username, email, inviteID) is truth-y
        Constants.removeMemberWaitingKey(teamname, username || email || inviteID),
      ]
    )
    if (loadingKey) {
      yield Saga.put(TeamsGen.createGetDetails({clearInviteLoadingKey: loadingKey, teamname}))
    }
  } catch (err) {
    logger.error('Failed to remove member or pending invite', err)
    if (loadingKey) {
      yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
    }
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
  const {teamname, role, phoneNumber, fullName = '', loadingKey} = action.payload
  if (loadingKey) {
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: true, loadingKey, teamname}))
  }
  try {
    const seitan: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise> = yield RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise(
      {
        label: {sms: {f: fullName || '', n: phoneNumber} as RPCTypes.SeitanKeyLabelSms, t: 1},
        name: teamname,
        role: (!!role && RPCTypes.TeamRole[role]) || RPCTypes.TeamRole.none,
      },
      [Constants.teamWaitingKey(teamname)]
    )
    /* Open SMS */
    const bodyText = generateSMSBody(teamname, seitan)
    yield openSMS([phoneNumber], bodyText)
    return TeamsGen.createGetDetails({clearInviteLoadingKey: loadingKey, teamname})
  } catch (err) {
    logger.info('Error sending SMS', err)
    if (loadingKey) {
      yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
    }
    return false
  }
}

const ignoreRequest = async (_: TypedState, action: TeamsGen.IgnoreRequestPayload) => {
  const {teamname, username} = action.payload
  try {
    await RPCTypes.teamsTeamIgnoreRequestRpcPromise(
      {name: teamname, username},
      Constants.teamWaitingKey(teamname)
    )
    return TeamsGen.createGetDetails({teamname})
  } catch (_) {
    // TODO handle error, but for now make sure loading is unset
    // TODO get rid of this once core sends us a notification for this (CORE-7125)
    return TeamsGen.createGetDetails({teamname}) // getDetails will unset loading
  }
}

function* createNewTeamFromConversation(
  state: TypedState,
  action: TeamsGen.CreateNewTeamFromConversationPayload
) {
  const {conversationIDKey, teamname} = action.payload
  const me = state.config.username
  let participants: Array<string> = []

  const meta = ChatConstants.getMeta(state, conversationIDKey)
  participants = meta.participants

  if (participants) {
    try {
      const createRes: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamCreateRpcPromise> = yield RPCTypes.teamsTeamCreateRpcPromise(
        {joinSubteam: false, name: teamname},
        Constants.teamCreationWaitingKey
      )
      for (const username of participants) {
        if (!createRes.creatorAdded || username !== me) {
          yield RPCTypes.teamsTeamAddMemberRpcPromise(
            {
              email: '',
              role: username === me ? RPCTypes.TeamRole.admin : RPCTypes.TeamRole.writer,
              sendChatNotification: true,
              teamID: createRes.teamID,
              username,
            },
            Constants.teamCreationWaitingKey
          )
        }
      }
      yield Saga.put(RouteTreeGen.createClearModals())
      yield Saga.put(Chat2Gen.createNavigateToInbox())
      yield Saga.put(
        Chat2Gen.createPreviewConversation({channelname: 'general', reason: 'convertAdHoc', teamname})
      )
    } catch (error) {
      yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
    }
  }
}

function* getDetails(_: TypedState, action: TeamsGen.GetDetailsPayload, logger: Saga.SagaLogger) {
  const {teamname} = action.payload
  yield Saga.put(TeamsGen.createGetTeamPublicity({teamname}))

  const waitingKeys = [Constants.teamWaitingKey(teamname), Constants.teamGetWaitingKey(teamname)]

  try {
    const unsafeDetails: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamGetRpcPromise> = yield RPCTypes.teamsTeamGetRpcPromise(
      {name: teamname},
      waitingKeys
    )

    // Don't allow the none default
    const details: RPCTypes.TeamDetails = {
      ...unsafeDetails,
      settings: {
        ...unsafeDetails.settings,
        joinAs:
          unsafeDetails.settings.joinAs === RPCTypes.TeamRole.none
            ? RPCTypes.TeamRole.reader
            : unsafeDetails.settings.joinAs,
      },
    }

    // Get requests to join
    let requests: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamListRequestsRpcPromise> | undefined
    const state: TypedState = yield* Saga.selectState()
    if (Constants.getCanPerform(state, teamname).manageMembers) {
      // TODO (DESKTOP-6478) move this somewhere else
      requests = yield RPCTypes.teamsTeamListRequestsRpcPromise({teamName: teamname}, waitingKeys)
    }

    if (!requests) {
      requests = []
    }
    requests.sort((a, b) => a.username.localeCompare(b.username))

    const requestMap = new Map<string, Array<string>>()
    requests.forEach(request => {
      let arr = requestMap.get(request.name)
      if (!arr) {
        arr = []
        requestMap.set(request.name, arr)
      }
      arr.push(request.username)
    })

    const invites = Constants.annotatedInvitesToInviteInfo(details.annotatedActiveInvites)

    // Get the subteam map for this team.
    const subTeam: Saga.RPCPromiseType<typeof RPCTypes.teamsTeamGetSubteamsRpcPromise> = yield RPCTypes.teamsTeamGetSubteamsRpcPromise(
      {name: {parts: teamname.split('.')}},
      waitingKeys
    )
    const {entries} = subTeam
    const subteamIDs = new Set<Types.TeamID>()
    const subteams = (entries || []).reduce<Array<string>>((arr, {name, teamID}) => {
      name.parts && arr.push(name.parts.join('.'))
      subteamIDs.add(teamID)
      return arr
    }, [])
    yield Saga.put(
      TeamsGen.createSetTeamDetails({
        invites: invites,
        members: details.members,
        requests: requestMap,
        settings: details.settings,
        subteamIDs,
        subteams: subteams,
        teamID: Constants.getTeamID(state, teamname),
        teamname,
      })
    )
  } catch (e) {
    logger.error(e)
  } finally {
    const loadingKey = action.payload.clearInviteLoadingKey
    if (loadingKey) {
      yield Saga.put(TeamsGen.createSetTeamLoadingInvites({isLoading: false, loadingKey, teamname}))
    }
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
          role: RPCTypes.TeamRole[role],
          sendChatNotification: true,
          teamID,
          username: user,
        },
        [Constants.teamWaitingKey(team), Constants.addUserToTeamsWaitingKey(user)]
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

function* getTeamPublicity(_: TypedState, action: TeamsGen.GetTeamPublicityPayload, logger: Saga.SagaLogger) {
  try {
    const teamname = action.payload.teamname
    // Get publicity settings for this team.
    const publicity: Saga.RPCPromiseType<typeof RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise> = yield RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise(
      {name: teamname},
      Constants.teamWaitingKey(teamname)
    )

    let tarsDisabled: Saga.RPCPromiseType<typeof RPCTypes.teamsGetTarsDisabledRpcPromise> = false
    // can throw if you're not an admin
    try {
      tarsDisabled = yield RPCTypes.teamsGetTarsDisabledRpcPromise(
        {name: teamname},
        Constants.teamTarsWaitingKey(teamname)
      )
    } catch (_) {}

    const publicityMap = {
      anyMemberShowcase: publicity.teamShowcase.anyMemberShowcase,
      description: publicity.teamShowcase.description || '',
      ignoreAccessRequests: tarsDisabled,
      member: publicity.isMemberShowcased,
      team: publicity.teamShowcase.isShowcased,
    }

    yield Saga.put(TeamsGen.createSetTeamPublicitySettings({publicity: publicityMap, teamname}))
  } catch (e) {
    logger.error(e.message)
  }
}

const getChannelInfo = async (
  state: TypedState,
  action: TeamsGen.GetChannelInfoPayload,
  logger: Saga.SagaLogger
) => {
  const {teamname, conversationIDKey} = action.payload
  const results = await RPCChatTypes.localGetInboxAndUnboxUILocalRpcPromise(
    {
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      query: ChatConstants.makeInboxQuery([conversationIDKey]),
    },
    Constants.teamWaitingKey(teamname)
  )
  const convs = results.conversations || []
  if (convs.length !== 1) {
    logger.warn(`Could not get channel info`)
    return false
  }

  const meta = ChatConstants.inboxUIItemToConversationMeta(state, convs[0])
  if (!meta) {
    logger.warn('Could not convert channel info to meta')
    return false
  }

  const channelInfo = {
    channelname: meta.channelname,
    description: meta.description,
    hasAllMembers: null,
    memberStatus: convs[0].memberStatus,
    mtime: meta.timestamp,
    numParticipants: meta.participants.length,
  }

  return TeamsGen.createSetTeamChannelInfo({channelInfo, conversationIDKey, teamname})
}

const getChannels = async (_: TypedState, action: TeamsGen.GetChannelsPayload) => {
  const teamname = action.payload.teamname
  const results = await RPCChatTypes.localGetTLFConversationsLocalRpcPromise(
    {
      membersType: RPCChatTypes.ConversationMembersType.team,
      tlfName: teamname,
      topicType: RPCChatTypes.TopicType.chat,
    },
    Constants.getChannelsWaitingKey(teamname)
  )
  const convs = results.convs || []
  const channelInfos: Map<ChatTypes.ConversationIDKey, Types.ChannelInfo> = new Map()
  convs.forEach(conv => {
    const convID = ChatTypes.stringToConversationIDKey(conv.convID)
    channelInfos.set(convID, {
      channelname: conv.channel,
      description: conv.headline,
      hasAllMembers: null,
      memberStatus: conv.memberStatus,
      mtime: conv.time,
      numParticipants: (conv.participants || []).length,
    })
  })

  return TeamsGen.createSetTeamChannels({channelInfos, teamname})
}

function* getTeams(
  state: TypedState,
  action: ConfigGen.StartupFirstIdlePayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload,
  logger: Saga.SagaLogger
) {
  const username = state.config.username
  if (!username) {
    logger.warn('getTeams while logged out')
    return
  }
  if (action.type === TeamsGen.getTeams) {
    const {forceReload} = action.payload
    if (!forceReload && !state.teams.teamDetailsMetaStale) {
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

    // Dismiss any stale badges for teams we're no longer in
    const teamResetUsers = state.teams.teamNameToResetUsers || new Map<string, Set<Types.ResetUser>>()
    const teamNameSet = new Set<string>(teamnames)
    const dismissIDs = [...teamResetUsers.entries()].reduce<Array<string>>((ids, [key, value]) => {
      if (!teamNameSet.has(key)) {
        ids.push(...[...value].map(ru => ru.badgeIDKey))
      }
      return ids
    }, [])
    yield Saga.all(
      dismissIDs.map(id =>
        Saga.callUntyped(
          RPCTypes.gregorDismissItemRpcPromise,
          {id: Constants.keyToResetUserBadgeID(id)},
          Constants.teamsLoadedWaitingKey
        )
      )
    )

    yield Saga.put(
      TeamsGen.createSetTeamInfo({
        teamDetails: Constants.teamListToDetails(teams),
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

const checkRequestedAccess = async (_: TypedState) => {
  const result = await RPCTypes.teamsTeamListMyAccessRequestsRpcPromise(
    {},
    Constants.teamsAccessRequestWaitingKey
  )
  const teams = (result || []).map(row => (row && row.parts ? row.parts.join('.') : ''))
  return TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: new Set<Types.Teamname>(teams)})
}

const _joinConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield RPCChatTypes.localJoinConversationByIDLocalRpcPromise({convID}, Constants.teamWaitingKey(teamname))
    yield Saga.put(
      TeamsGen.createAddParticipant({
        conversationIDKey,
        teamname,
      })
    )
  } catch (error) {
    yield Saga.put(ConfigGen.createGlobalError({globalError: convertToError(error)}))
  }
}

const _leaveConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield RPCChatTypes.localLeaveConversationLocalRpcPromise({convID}, Constants.teamWaitingKey(teamname))
    yield Saga.put(TeamsGen.createRemoveParticipant({conversationIDKey, teamname}))
  } catch (error) {
    yield Saga.put(ConfigGen.createGlobalError({globalError: convertToError(error)}))
  }
}

function* saveChannelMembership(_: TypedState, action: TeamsGen.SaveChannelMembershipPayload) {
  const {teamname, oldChannelState, newChannelState} = action.payload

  const calls: Array<any> = []
  for (const convIDKeyStr in newChannelState) {
    const convIDKey = ChatTypes.stringToConversationIDKey(convIDKeyStr)
    if (oldChannelState[convIDKey] === newChannelState[convIDKey]) {
      continue
    }

    if (newChannelState[convIDKey]) {
      calls.push(Saga.callUntyped(_joinConversation, teamname, convIDKey))
    } else {
      calls.push(Saga.callUntyped(_leaveConversation, teamname, convIDKey))
    }
  }

  yield Saga.all(calls)
  if (calls.length) {
    yield Saga.put(TeamsGen.createGetChannels({teamname}))
  }
}

function* createChannel(_: TypedState, action: TeamsGen.CreateChannelPayload, logger: Saga.SagaLogger) {
  const {channelname, description, teamname} = action.payload
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
      Constants.createChannelWaitingKey(teamname)
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
        Constants.createChannelWaitingKey(teamname)
      )
    }

    // Dismiss the create channel dialog.
    const visibleScreen = Router2Constants.getVisibleScreen()
    if (visibleScreen && visibleScreen.routeName === 'chatCreateChannel') {
      yield Saga.put(RouteTreeGen.createClearModals())
    }

    // Select the new channel, and switch to the chat tab.
    yield Saga.put(
      Chat2Gen.createPreviewConversation({
        channelname,
        conversationIDKey: newConversationIDKey,
        reason: 'newChannel',
        teamname,
      })
    )
  } catch (error) {
    yield Saga.put(TeamsGen.createSetChannelCreationError({error: error.desc}))
  }
}

const setMemberPublicity = async (_: TypedState, action: TeamsGen.SetMemberPublicityPayload) => {
  const {teamname, showcase} = action.payload
  try {
    await RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
      {
        isShowcased: showcase,
        name: teamname,
      },
      Constants.teamWaitingKey(teamname)
    )
    return [
      TeamsGen.createGetDetails({teamname}),
      // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
      // TeamsGen.createGetTeams(), // TODO Y2K-974 probably broken
    ]
  } catch (_) {
    // TODO handle error, but for now make sure loading is unset
    return [
      TeamsGen.createGetDetails({teamname}),
      // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
      // TeamsGen.createGetTeams(), // TODO Y2K-974 probably broken
    ]
  }
}

function* setPublicity(state: TypedState, action: TeamsGen.SetPublicityPayload, logger: Saga.SagaLogger) {
  const {teamname, settings} = action.payload
  const waitingKey = Constants.settingsWaitingKey(teamname)

  const teamID = Constants.getTeamID(state, teamname)
  if (teamID === Types.noTeamID) {
    // TODO Y2K-1084 teamID should come in the action
    logger.error(`no team ID for ${teamname}`)
    return
  }
  const teamSettings = state.teams.teamDetails.get(teamID)?.settings || Constants.initialTeamSettings

  const teamPublicitySettings = Constants.getTeamPublicitySettings(state, teamname)

  const ignoreAccessRequests = teamPublicitySettings.ignoreAccessRequests
  const openTeam = teamSettings.open
  const openTeamRole = Constants.teamRoleByEnum[teamSettings.joinAs]
  const publicityAnyMember = teamPublicitySettings.anyMemberShowcase
  const publicityMember = teamPublicitySettings.member
  const publicityTeam = teamPublicitySettings.team

  const calls: Array<any> = []
  if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
    calls.push(
      Saga.callUntyped(async () => {
        try {
          const payload = await RPCTypes.teamsTeamSetSettingsRpcPromise(
            {
              name: teamname,
              settings: {
                joinAs: RPCTypes.TeamRole[settings.openTeamRole],
                open: settings.openTeam,
              },
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
            {disabled: settings.ignoreAccessRequests, name: teamname},
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
            {anyMemberShowcase: settings.publicityAnyMember, name: teamname},
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
            {isShowcased: settings.publicityMember, name: teamname},
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
            {isShowcased: settings.publicityTeam, name: teamname},
            waitingKey
          )
          return {payload, type: 'ok'}
        } catch (payload) {
          return {payload, type: 'error'}
        }
      })
    )
  }

  const results = yield Saga.all(calls)
  // TODO delete this getDetails call when CORE-7125 is finished
  yield Saga.put(TeamsGen.createGetDetails({teamname}))

  // Display any errors from the rpcs
  const errs = results
    .filter(r => r.type === 'error')
    .map(({payload}) => Saga.put(ConfigGen.createGlobalError({globalError: convertToError(payload)})))
  yield Saga.all(errs)
}

const teamChangedByID = (state: TypedState, action: EngineGen.Keybase1NotifyTeamTeamChangedByIDPayload) => {
  const {teamID} = action.payload.params
  const selectedTeams = Constants.getSelectedTeams()
  if (selectedTeams.includes(teamID) && _wasOnTeamsTab()) {
    // only reload if that team is selected
    const teamname = Constants.getTeamNameFromID(state, teamID)
    return [!!teamname && TeamsGen.createGetDetails({teamname})]
  }
  return getLoadCalls()
}

const teamRoleMapChangedUpdateLatestKnownVersion = (
  _: TypedState,
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
  _,
  action: EngineGen.Keybase1NotifyTeamTeamDeletedPayload | EngineGen.Keybase1NotifyTeamTeamExitPayload
) => {
  const {teamID} = action.payload.params
  const selectedTeams = Constants.getSelectedTeams()
  if (selectedTeams.includes(teamID)) {
    return [RouteTreeGen.createNavUpToScreen({routeName: 'teamsRoot'}), ...getLoadCalls()]
  }
  return getLoadCalls()
}

const getLoadCalls = (teamname?: string) => (teamname ? [TeamsGen.createGetDetails({teamname})] : [])

const reloadTeamListIfSubscribed = (state: TypedState, _, logger: Saga.SagaLogger) => {
  if (state.teams.teamDetailsMetaSubscribeCount > 0) {
    logger.info('eagerly reloading')
    return TeamsGen.createGetTeams()
  } else {
    logger.info('skipping')
  }
  return false
}

const updateTopic = async (_: TypedState, action: TeamsGen.UpdateTopicPayload) => {
  const {teamname, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  await RPCChatTypes.localPostHeadlineRpcPromise(param, Constants.teamWaitingKey(teamname))
  return TeamsGen.createSetUpdatedTopic({conversationIDKey, newTopic, teamname})
}

function* addTeamWithChosenChannels(
  state: TypedState,
  action: TeamsGen.AddTeamWithChosenChannelsPayload,
  logger
) {
  const existingTeams = state.teams.teamsWithChosenChannels
  const {teamname} = action.payload
  if (state.teams.teamsWithChosenChannels.has(teamname)) {
    // we've already dismissed for this team and we already know about it, bail
    return
  }
  const logPrefix = `[addTeamWithChosenChannels]:${teamname}`
  let pushState: Saga.RPCPromiseType<typeof RPCTypes.gregorGetStateRpcPromise>
  try {
    pushState = yield RPCTypes.gregorGetStateRpcPromise(undefined, Constants.teamWaitingKey(teamname))
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
    teams.map(t => Constants.teamWaitingKey(t))
  )
}

const updateChannelname = async (_: TypedState, action: TeamsGen.UpdateChannelNamePayload) => {
  const {teamname, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  try {
    await RPCChatTypes.localPostMetadataRpcPromise(param, Constants.teamWaitingKey(teamname))
    return TeamsGen.createSetUpdatedChannelName({conversationIDKey, newChannelName, teamname})
  } catch (error) {
    return TeamsGen.createSetChannelCreationError({error: error.desc})
  }
}

const deleteChannelConfirmed = async (_: TypedState, action: TeamsGen.DeleteChannelConfirmedPayload) => {
  const {teamname, conversationIDKey} = action.payload
  // channelName is only needed for confirmation, so since we handle
  // confirmation ourselves we don't need to plumb it through.
  await RPCChatTypes.localDeleteConversationLocalRpcPromise(
    {
      channelName: '',
      confirmed: true,
      convID: ChatTypes.keyToConversationID(conversationIDKey),
    },
    Constants.teamWaitingKey(teamname)
  )
  return TeamsGen.createDeleteChannelInfo({conversationIDKey, teamname})
}

const getMembers = async (_: TypedState, action: TeamsGen.GetMembersPayload, logger: Saga.SagaLogger) => {
  const {teamname} = action.payload
  try {
    const res = await RPCTypes.teamsTeamGetMembersRpcPromise({
      name: teamname,
    })
    const members = Constants.rpcDetailsToMemberInfos(res)
    return TeamsGen.createSetMembers({members, teamname})
  } catch (error) {
    logger.error(`Error updating members for ${teamname}: ${error.desc}`)
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
  const newTeamRequests = badgeState.newTeamAccessRequests || []

  const teamsWithResetUsers: Array<RPCTypes.TeamMemberOutReset> = badgeState.teamsWithResetUsers || []
  const teamsWithResetUsersMap = new Map<string, Set<Types.ResetUser>>()
  teamsWithResetUsers.forEach(entry => {
    const existing = mapGetEnsureValue(teamsWithResetUsersMap, entry.teamname, new Set())
    existing.add({badgeIDKey: Constants.resetUserBadgeIDToKey(entry.id), username: entry.username})
  })

  /* TODO team notifications should handle what the following block did */
  // if (_wasOnTeamsTab() && (newTeams.size > 0 || newTeamRequests.size > 0 || deletedTeams.length > 0)) {
  //   // Call getTeams if new teams come in.
  //   // Covers the case when we're staring at the teams page so
  //   // we don't miss a notification we clear when we tab away
  //   const existingNewTeams = state.teams.newTeams || I.Set()
  //   const existingNewTeamRequests = state.teams.newTeamRequests || I.List()
  //   if (!newTeams.equals(existingNewTeams) && newTeams.size > 0) {
  //     // We have been added to a new team & we need to refresh the list
  //     actions.push(TeamsGen.createGetTeams())
  //   }

  //   // getDetails for teams that have new access requests
  //   // Covers case where we have a badge appear on the requests
  //   // tab with no rows showing up
  //   const newTeamRequestsSet = I.Set(newTeamRequests)
  //   // TODO ts-migration remove any
  //   const existingNewTeamRequestsSet = I.Set(existingNewTeamRequests)
  //   // TODO ts-migration remove any
  //   const toLoad: I.Set<any> = newTeamRequestsSet.subtract(existingNewTeamRequestsSet)
  //   const loadingCalls = toLoad.map(teamname => TeamsGen.createGetDetails({teamname})).toArray()
  //   actions = actions.concat(loadingCalls)
  // }

  // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
  actions.push(
    TeamsGen.createSetNewTeamInfo({
      deletedTeams,
      newTeamRequests,
      newTeams,
      teamNameToResetUsers: teamsWithResetUsersMap,
    })
  )
  return actions
}

const _wasOnTeamsTab = () => Constants.isOnTeamsTab()

const gregorPushState = (_: TypedState, action: GregorGen.PushStatePayload) => {
  const actions: Array<TypedActions> = []
  const items = action.payload.state
  const sawChatBanner = items.find(i => i.item && i.item.category === 'sawChatBanner')
  if (sawChatBanner) {
    actions.push(TeamsGen.createSetTeamSawChatBanner())
  }

  const sawSubteamsBanner = items.find(i => i.item && i.item.category === 'sawSubteamsBanner')
  if (sawSubteamsBanner) {
    actions.push(TeamsGen.createSetTeamSawSubteamsBanner())
  }

  const chosenChannels = items.find(i => i.item && i.item.category === Constants.chosenChannelsGregorKey)
  const teamsWithChosenChannelsStr =
    chosenChannels && chosenChannels.item && chosenChannels.item.body && chosenChannels.item.body.toString()
  const teamsWithChosenChannels = teamsWithChosenChannelsStr
    ? new Set<Types.Teamname>(JSON.parse(teamsWithChosenChannelsStr))
    : new Set<Types.Teamname>()
  actions.push(TeamsGen.createSetTeamsWithChosenChannels({teamsWithChosenChannels}))

  return actions
}

const renameTeam = async (_: TypedState, action: TeamsGen.RenameTeamPayload) => {
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
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'team.request_access'})
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'team.delete'})
  } catch (err) {
    logError(err)
  }
}

function addThemToTeamFromTeamBuilder(
  state: TypedState,
  {payload: {teamID}}: TeamBuildingGen.FinishedTeamBuildingPayload,
  logger: Saga.SagaLogger
) {
  if (!teamID) {
    logger.error("Trying to add them to a team, but I don't know what the teamID is.")
    return
  }

  const role = state.teams.teamBuilding.finishedSelectedRole
  const sendChatNotification = state.teams.teamBuilding.finishedSendNotification

  const users = [...state.teams.teamBuilding.finishedTeam].map(user => ({assertion: user.id, role}))
  return TeamsGen.createAddToTeam({
    sendChatNotification,
    teamID,
    users,
  })
}

function* teamBuildingSaga() {
  yield* commonTeamBuildingSaga('teams')

  yield* Saga.chainAction2(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('teams', addThemToTeamFromTeamBuilder)
  )
}

const teamsSaga = function*() {
  yield* Saga.chainAction2(TeamsGen.leaveTeam, leaveTeam, 'leaveTeam')
  yield* Saga.chainGenerator<TeamsGen.DeleteTeamPayload>(TeamsGen.deleteTeam, deleteTeam, 'deleteTeam')
  yield* Saga.chainAction2(TeamsGen.getTeamProfileAddList, getTeamProfileAddList, 'getTeamProfileAddList')
  yield* Saga.chainAction2(TeamsGen.leftTeam, leftTeam, 'leftTeam')
  yield* Saga.chainAction2(TeamsGen.createNewTeam, createNewTeam, 'createNewTeam')
  yield* Saga.chainGenerator<TeamsGen.JoinTeamPayload>(TeamsGen.joinTeam, joinTeam, 'joinTeam')
  yield* Saga.chainGenerator<TeamsGen.GetDetailsPayload>(TeamsGen.getDetails, getDetails, 'getDetails')
  yield* Saga.chainAction2(TeamsGen.getMembers, getMembers, 'getMembers')
  yield* Saga.chainGenerator<TeamsGen.GetTeamPublicityPayload>(
    TeamsGen.getTeamPublicity,
    getTeamPublicity,
    'getTeamPublicity'
  )
  yield* Saga.chainGenerator<TeamsGen.CreateNewTeamFromConversationPayload>(
    TeamsGen.createNewTeamFromConversation,
    createNewTeamFromConversation,
    'createNewTeamFromConversation'
  )
  yield* Saga.chainAction2(TeamsGen.getChannelInfo, getChannelInfo, 'getChannelInfo')
  yield* Saga.chainAction2(TeamsGen.getChannels, getChannels, 'getChannels')
  yield* Saga.chainGenerator<
    ConfigGen.StartupFirstIdlePayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload
  >([ConfigGen.startupFirstIdle, TeamsGen.getTeams, TeamsGen.leftTeam], getTeams, 'getTeams')
  yield* Saga.chainGenerator<TeamsGen.SaveChannelMembershipPayload>(
    TeamsGen.saveChannelMembership,
    saveChannelMembership,
    'saveChannelMembership'
  )
  yield* Saga.chainAction2(
    [ConfigGen.bootstrapStatusLoaded, EngineGen.keybase1NotifyTeamTeamRoleMapChanged],
    refreshTeamRoleMap,
    'refreshTeamRoleMap'
  )

  yield* Saga.chainGenerator<TeamsGen.CreateChannelPayload>(
    TeamsGen.createChannel,
    createChannel,
    'createChannel'
  )
  yield* Saga.chainAction2(TeamsGen.addToTeam, addToTeam, 'addToTeam')
  yield* Saga.chainAction2(TeamsGen.reAddToTeam, reAddToTeam, 'reAddToTeam')
  yield* Saga.chainGenerator<TeamsGen.AddUserToTeamsPayload>(
    TeamsGen.addUserToTeams,
    addUserToTeams,
    'addUserToTeams'
  )
  yield* Saga.chainGenerator<TeamsGen.InviteToTeamByEmailPayload>(
    TeamsGen.inviteToTeamByEmail,
    inviteByEmail,
    'inviteByEmail'
  )
  yield* Saga.chainAction2(TeamsGen.ignoreRequest, ignoreRequest, 'ignoreRequest')
  yield* Saga.chainAction2(TeamsGen.editTeamDescription, editDescription, 'editDescription')
  yield* Saga.chainAction2(TeamsGen.uploadTeamAvatar, uploadAvatar, 'uploadAvatar')
  yield* Saga.chainAction2(TeamsGen.editMembership, editMembership, 'editMembership')
  yield* Saga.chainGenerator<TeamsGen.RemoveMemberOrPendingInvitePayload>(
    TeamsGen.removeMemberOrPendingInvite,
    removeMemberOrPendingInvite,
    'removeMemberOrPendingInvite'
  )
  yield* Saga.chainAction2(TeamsGen.setMemberPublicity, setMemberPublicity, 'setMemberPublicity')
  yield* Saga.chainAction2(TeamsGen.updateTopic, updateTopic, 'updateTopic')
  yield* Saga.chainAction2(TeamsGen.updateChannelName, updateChannelname, 'updateChannelname')
  yield* Saga.chainAction2(TeamsGen.deleteChannelConfirmed, deleteChannelConfirmed, 'deleteChannelConfirmed')
  yield* Saga.chainGenerator<TeamsGen.InviteToTeamByPhonePayload>(
    TeamsGen.inviteToTeamByPhone,
    inviteToTeamByPhone,
    'inviteToTeamByPhone'
  )
  yield* Saga.chainGenerator<TeamsGen.SetPublicityPayload>(
    TeamsGen.setPublicity,
    setPublicity,
    'setPublicity'
  )
  yield* Saga.chainAction2(TeamsGen.checkRequestedAccess, checkRequestedAccess, 'checkRequestedAccess')
  yield* Saga.chainAction2(TeamsGen.getTeamRetentionPolicy, getTeamRetentionPolicy, 'getTeamRetentionPolicy')
  yield* Saga.chainAction2(
    TeamsGen.saveTeamRetentionPolicy,
    saveTeamRetentionPolicy,
    'saveTeamRetentionPolicy'
  )
  yield* Saga.chainAction2(
    Chat2Gen.updateTeamRetentionPolicy,
    updateTeamRetentionPolicy,
    'updateTeamRetentionPolicy'
  )
  yield* Saga.chainGenerator<TeamsGen.AddTeamWithChosenChannelsPayload>(
    TeamsGen.addTeamWithChosenChannels,
    addTeamWithChosenChannels,
    'addTeamWithChosenChannels'
  )
  yield* Saga.chainAction2(TeamsGen.renameTeam, renameTeam)
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, badgeAppForTeams, 'badgeAppForTeams')
  yield* Saga.chainAction2(GregorGen.pushState, gregorPushState, 'gregorPushState')
  yield* Saga.chainAction2(EngineGen.keybase1NotifyTeamTeamChangedByID, teamChangedByID, 'teamChangedByID')
  yield* Saga.chainAction2(
    EngineGen.keybase1NotifyTeamTeamRoleMapChanged,
    teamRoleMapChangedUpdateLatestKnownVersion,
    'teamRoleMapChangedUpdateLatestKnownVersion'
  )

  yield* Saga.chainAction2(
    [EngineGen.keybase1NotifyTeamTeamDeleted, EngineGen.keybase1NotifyTeamTeamExit],
    teamDeletedOrExit,
    'teamDeletedOrExit'
  )

  yield* Saga.chainAction2(
    [EngineGen.keybase1NotifyTeamTeamMetadataUpdate, GregorGen.updateReachable],
    reloadTeamListIfSubscribed,
    'reloadTeamListIfSubscribed'
  )

  yield* Saga.chainAction2(TeamsGen.clearNavBadges, clearNavBadges)

  // Hook up the team building sub saga
  yield* teamBuildingSaga()
}

export default teamsSaga

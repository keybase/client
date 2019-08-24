// TODO the relationships here are often inverted. we want to clear actions when a bunch of actions happen
// not have every handler clear it themselves. this reduces the nubmer of actionChains
import * as I from 'immutable'
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

function* createNewTeam(_: TypedState, action: TeamsGen.CreateNewTeamPayload) {
  const {joinSubteam, teamname} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  try {
    yield RPCTypes.teamsTeamCreateRpcPromise({joinSubteam, name: teamname}, Constants.teamCreationWaitingKey)

    yield Saga.sequentially([
      Saga.put(RouteTreeGen.createClearModals()),
      Saga.put(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]})),
      ...(isMobile
        ? []
        : [
            Saga.put(
              RouteTreeGen.createNavigateAppend({
                path: [{props: {createdTeam: true, teamname}, selected: 'teamEditTeamAvatar'}],
              })
            ),
          ]),
    ])
  } catch (error) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
  }
}

function* joinTeam(_: TypedState, action: TeamsGen.JoinTeamPayload) {
  const {teamname} = action.payload
  yield Saga.all([
    Saga.put(TeamsGen.createSetTeamJoinError({error: ''})),
    Saga.put(TeamsGen.createSetTeamJoinSuccess({success: false, teamname: ''})),
  ])
  try {
    const result: Saga.RPCPromiseType<
      typeof RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise
    > = yield Saga.callUntyped(
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

const getTeamProfileAddList = (_: TypedState, action: TeamsGen.GetTeamProfileAddListPayload) =>
  RPCTypes.teamsTeamProfileAddListRpcPromise(
    {username: action.payload.username},
    Constants.teamProfileAddListWaitingKey
  ).then(res => {
    const teamlist =
      res &&
      res.map(team => ({
        disabledReason: team.disabledReason,
        open: team.open,
        teamName: team.teamName.parts ? team.teamName.parts.join('.') : '',
      }))
    if (teamlist) {
      teamlist.sort((a, b) => a.teamName.localeCompare(b.teamName))
    }
    return TeamsGen.createSetTeamProfileAddList({teamlist: I.List(teamlist || [])})
  })

function* deleteTeam(_: TypedState, action: TeamsGen.DeleteTeamPayload) {
  yield* Saga.callRPCs(
    RPCTypes.teamsTeamDeleteRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.teamsUi.confirmRootTeamDelete': (_, response) => response.result(true),
        'keybase.1.teamsUi.confirmSubteamDelete': (_, response) => response.result(true),
      },
      incomingCallMap: {},
      params: {
        name: action.payload.teamname,
      },
      waitingKey: Constants.deleteTeamWaitingKey(action.payload.teamname),
    })
  )
}
const leaveTeam = (_: TypedState, action: TeamsGen.LeaveTeamPayload, logger: Saga.SagaLogger) => {
  const {context, teamname} = action.payload
  logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
  return RPCTypes.teamsTeamLeaveRpcPromise(
    {
      name: teamname,
      permanent: false,
    },
    Constants.leaveTeamWaitingKey(teamname)
  ).then(() => {
    logger.info(`leaveTeam: left ${teamname} successfully`)
    return TeamsGen.createLeftTeam({context, teamname})
  })
}

const leftTeam = () => RouteTreeGen.createNavUpToScreen({routeName: 'teamsRoot'})

const getTeamRetentionPolicy = (
  state: TypedState,
  action: TeamsGen.GetTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {teamname} = action.payload
  const teamID = Constants.getTeamID(state, teamname)
  if (!teamID) {
    const errMsg = `getTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    return
  }

  let retentionPolicy = Constants.makeRetentionPolicy()
  return RPCChatTypes.localGetTeamRetentionLocalRpcPromise({teamID}, Constants.teamWaitingKey(teamname))
    .then(policy => {
      try {
        retentionPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(policy)
        if (retentionPolicy.type === 'inherit') {
          throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
        }
      } catch (err) {
        logger.error(err.message)
        throw err
      }
      return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamname})
    })
    .catch(() => TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamname}))
}

const saveTeamRetentionPolicy = (
  state: TypedState,
  action: TeamsGen.SaveTeamRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {teamname, policy} = action.payload

  // get teamID
  const teamID = Constants.getTeamID(state, teamname)
  if (!teamID) {
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
  const {convs} = action.payload
  const first = convs[0]
  if (!first) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetention, name} = first
  try {
    const newPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(teamRetention)
    return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy: newPolicy, teamname: name})
  } catch (err) {
    logger.error(err.message)
    throw err
  }
}

function* inviteByEmail(_: TypedState, action: TeamsGen.InviteToTeamByEmailPayload, logger: Saga.SagaLogger) {
  const {invitees, role, teamname} = action.payload
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: true, teamname}))
  try {
    const res: Saga.RPCPromiseType<
      typeof RPCTypes.teamsTeamAddEmailsBulkRpcPromise
    > = yield RPCTypes.teamsTeamAddEmailsBulkRpcPromise(
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
  } catch (err) {
    // other error. display messages and leave all emails in input box
    yield Saga.put(TeamsGen.createSetEmailInviteError({malformed: [], message: err.desc}))
  } finally {
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: false, teamname}))
  }
}

const addToTeamWaitingKeys = (teamname, username) => [
  Constants.teamWaitingKey(teamname),
  Constants.addMemberWaitingKey(teamname, username),
]

const addReAddErrorHandler = (username, e) => {
  // identify error
  if (e.code === RPCTypes.StatusCode.scidentifysummaryerror) {
    if (isMobile) {
      // show profile card on mobile
      return ProfileGen.createShowUserProfile({username})
    } else {
      // otherwise show tracker popup
      return Tracker2Gen.createShowUser({asTracker: true, username})
    }
  }
  return undefined
}

const addToTeam = (_: TypedState, action: TeamsGen.AddToTeamPayload) => {
  const {teamname, username, role, sendChatNotification} = action.payload
  return RPCTypes.teamsTeamAddMemberRpcPromise(
    {
      email: '',
      name: teamname,
      role: role ? RPCTypes.TeamRole[role] : RPCTypes.TeamRole.none,
      sendChatNotification,
      username,
    },
    addToTeamWaitingKeys(teamname, username)
  )
    .then(() => {})
    .catch(e => addReAddErrorHandler(username, e))
}

const reAddToTeam = (state: TypedState, action: TeamsGen.ReAddToTeamPayload) => {
  const {teamname, username} = action.payload
  const id = state.teams.teamNameToID.get(teamname, '')
  if (!id) {
    throw new Error(`team ID not on file for team '${teamname}'`)
  }
  return RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise(
    {
      id,
      username,
    },
    addToTeamWaitingKeys(teamname, username)
  )
    .then(() => {})
    .catch(e => addReAddErrorHandler(username, e))
}

const editDescription = (_: TypedState, action: TeamsGen.EditTeamDescriptionPayload) => {
  const {teamname, description} = action.payload
  return RPCTypes.teamsSetTeamShowcaseRpcPromise(
    {
      description,
      name: teamname,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => TeamsGen.createGetDetails({teamname}))
    .catch(() =>
      // TODO We don't get a team changed notification for this. Delete this call when CORE-7125 is finished.
      TeamsGen.createGetDetails({teamname})
    )
}

const uploadAvatar = (_: TypedState, action: TeamsGen.UploadTeamAvatarPayload, logger: Saga.SagaLogger) => {
  const {crop, filename, sendChatNotification, teamname} = action.payload
  return RPCTypes.teamsUploadTeamAvatarRpcPromise(
    {
      crop,
      filename,
      sendChatNotification,
      teamname,
    },
    uploadAvatarWaitingKey
  )
    .then(() => RouteTreeGen.createNavigateUp())
    .catch(e => {
      // error displayed in component
      logger.warn(`Error uploading team avatar: ${e.message}`)
    })
}

const editMembership = (_: TypedState, action: TeamsGen.EditMembershipPayload) => {
  const {teamname, username, role} = action.payload
  return RPCTypes.teamsTeamEditMemberRpcPromise(
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
  const {teamname, username, email, inviteID} = action.payload

  const invitees = username || email || inviteID
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: true, teamname}))

  // disallow call with any pair of username, email, and ID to avoid black-bar errors
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  try {
    yield RPCTypes.teamsTeamRemoveMemberRpcPromise(
      {
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
  } finally {
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: false, teamname}))
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

const inviteToTeamByPhone = (
  _: TypedState,
  action: TeamsGen.InviteToTeamByPhonePayload,
  logger: Saga.SagaLogger
) => {
  const {teamname, role, phoneNumber, fullName = ''} = action.payload
  return RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise(
    {
      label: {sms: {f: fullName || '', n: phoneNumber} as RPCTypes.SeitanKeyLabelSms, t: 1},
      name: teamname,
      role: (!!role && RPCTypes.TeamRole[role]) || RPCTypes.TeamRole.none,
    },
    Constants.teamWaitingKey(teamname)
  ).then(seitan => {
    /* Open SMS */
    const bodyText = generateSMSBody(teamname, seitan)
    return openSMS([phoneNumber], bodyText)
      .then(() => TeamsGen.createGetDetails({teamname}))
      .catch(err => logger.info('Error sending SMS', err))
  })
}

const ignoreRequest = (_: TypedState, action: TeamsGen.IgnoreRequestPayload) => {
  const {teamname, username} = action.payload
  return RPCTypes.teamsTeamIgnoreRequestRpcPromise(
    {
      name: teamname,
      username,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => TeamsGen.createGetDetails({teamname}))
    .catch(
      () =>
        // TODO handle error, but for now make sure loading is unset
        // TODO get rid of this once core sends us a notification for this (CORE-7125)
        TeamsGen.createGetDetails({teamname}) // getDetails will unset loading
    )
}

function* createNewTeamFromConversation(
  state: TypedState,
  action: TeamsGen.CreateNewTeamFromConversationPayload
) {
  const {conversationIDKey, teamname} = action.payload
  const me = state.config.username
  let participants: Array<string> = []

  const meta = ChatConstants.getMeta(state, conversationIDKey)
  participants = meta.participants.toArray()

  if (participants) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
    try {
      const createRes: Saga.RPCPromiseType<
        typeof RPCTypes.teamsTeamCreateRpcPromise
      > = yield RPCTypes.teamsTeamCreateRpcPromise(
        {joinSubteam: false, name: teamname},
        Constants.teamCreationWaitingKey
      )
      for (const username of participants) {
        if (!createRes.creatorAdded || username !== me) {
          yield RPCTypes.teamsTeamAddMemberRpcPromise(
            {
              email: '',
              name: teamname,
              role: username === me ? RPCTypes.TeamRole.admin : RPCTypes.TeamRole.writer,
              sendChatNotification: true,
              username,
            },
            Constants.teamCreationWaitingKey
          )
        }
      }
      yield Saga.put(RouteTreeGen.createClearModals())
      yield Saga.put(Chat2Gen.createNavigateToInbox({findNewConversation: false}))
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
  yield Saga.put(TeamsGen.createGetTeamOperations({teamname}))
  yield Saga.put(TeamsGen.createGetTeamPublicity({teamname}))

  const waitingKeys = [Constants.teamWaitingKey(teamname), Constants.teamGetWaitingKey(teamname)]

  try {
    const unsafeDetails: Saga.RPCPromiseType<
      typeof RPCTypes.teamsTeamGetRpcPromise
    > = yield RPCTypes.teamsTeamGetRpcPromise({name: teamname}, waitingKeys)

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

    const requestMap = requests.reduce((reqMap, req) => {
      if (!reqMap[req.name]) {
        reqMap[req.name] = I.Set()
      }
      reqMap[req.name] = reqMap[req.name].add(Constants.makeRequestInfo({username: req.username}))
      return reqMap
    }, {})

    const invites = Object.values(details.annotatedActiveInvites).reduce<Array<Types.InviteInfo>>(
      (arr, invite) => {
        const role = Constants.teamRoleByEnum[invite.role]
        if (role === 'none') {
          return arr
        }

        let username = ''
        const t = invite.type
        if (t.c === RPCTypes.TeamInviteCategory.sbs) {
          const sbs: RPCTypes.TeamInviteSocialNetwork = t.sbs || ''
          username = `${invite.name}@${sbs}`
        }
        arr.push(
          Constants.makeInviteInfo({
            email: invite.type.c === RPCTypes.TeamInviteCategory.email ? invite.name : '',
            id: invite.id,
            name: invite.type.c === RPCTypes.TeamInviteCategory.seitan ? invite.name : '',
            role,
            username,
          })
        )
        return arr
      },
      []
    )

    // if we have no requests for this team, make sure we don't hold on to any old ones
    if (!requestMap[teamname]) {
      yield Saga.put(TeamsGen.createClearTeamRequests({teamname}))
    }

    // Get the subteam map for this team.
    const subTeam: Saga.RPCPromiseType<
      typeof RPCTypes.teamsTeamGetSubteamsRpcPromise
    > = yield RPCTypes.teamsTeamGetSubteamsRpcPromise({name: {parts: teamname.split('.')}}, waitingKeys)
    const {entries} = subTeam
    const subteams = (entries || []).reduce<Array<string>>((arr, {name}) => {
      name.parts && arr.push(name.parts.join('.'))
      return arr
    }, [])
    yield Saga.put(
      TeamsGen.createSetTeamDetails({
        invites: I.Set(invites),
        members: Constants.rpcDetailsToMemberInfos(details.members),
        requests: I.Map(requestMap),
        settings: Constants.makeTeamSettings(details.settings),
        subteams: I.Set(subteams),
        teamname,
      })
    )
  } catch (e) {
    logger.error(e)
  }
}

const getDetailsForAllTeams = (state: TypedState) =>
  state.teams.teamnames.toArray().map(teamname => TeamsGen.createGetDetails({teamname}))

function* addUserToTeams(_: TypedState, action: TeamsGen.AddUserToTeamsPayload) {
  const {role, teams, user} = action.payload
  const teamsAddedTo: Array<string> = []
  const errorAddingTo: Array<string> = []
  for (const team of teams) {
    try {
      yield RPCTypes.teamsTeamAddMemberRpcPromise(
        {
          email: '',
          name: team,
          role: RPCTypes.TeamRole[role],
          sendChatNotification: true,
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

const getTeamOperations = (_: TypedState, action: TeamsGen.GetTeamOperationsPayload) =>
  RPCTypes.teamsCanUserPerformRpcPromise(
    {name: action.payload.teamname},
    Constants.teamWaitingKey(action.payload.teamname)
  ).then(teamOperation =>
    TeamsGen.createSetTeamCanPerform({teamOperation, teamname: action.payload.teamname})
  )

function* getTeamPublicity(_: TypedState, action: TeamsGen.GetTeamPublicityPayload, logger: Saga.SagaLogger) {
  try {
    const teamname = action.payload.teamname
    // Get publicity settings for this team.
    const publicity: Saga.RPCPromiseType<
      typeof RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise
    > = yield RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise(
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

const getChannelInfo = (_: TypedState, action: TeamsGen.GetChannelInfoPayload, logger: Saga.SagaLogger) => {
  const {teamname, conversationIDKey} = action.payload
  return RPCChatTypes.localGetInboxAndUnboxUILocalRpcPromise(
    {
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      query: ChatConstants.makeInboxQuery([conversationIDKey]),
    },
    Constants.teamWaitingKey(teamname)
  ).then(results => {
    const convs = results.conversations || []
    if (convs.length !== 1) {
      logger.warn(`Could not get channel info`)
      return
    }

    const meta = ChatConstants.inboxUIItemToConversationMeta(convs[0])
    if (!meta) {
      logger.warn('Could not convert channel info to meta')
      return
    }

    const channelInfo = Constants.makeChannelInfo({
      channelname: meta.channelname,
      description: meta.description,
      hasAllMembers: null,
      memberStatus: convs[0].memberStatus,
      mtime: meta.timestamp,
      numParticipants: meta.participants.size,
    })

    return TeamsGen.createSetTeamChannelInfo({channelInfo, conversationIDKey, teamname})
  })
}

const getChannels = (_: TypedState, action: TeamsGen.GetChannelsPayload) => {
  const teamname = action.payload.teamname
  return RPCChatTypes.localGetTLFConversationsLocalRpcPromise(
    {
      membersType: RPCChatTypes.ConversationMembersType.team,
      tlfName: teamname,
      topicType: RPCChatTypes.TopicType.chat,
    },
    Constants.getChannelsWaitingKey(teamname)
  ).then(results => {
    const convs = results.convs || []
    const channelInfos: {[K in ChatTypes.ConversationIDKey]: Types.ChannelInfo} = {}
    convs.forEach(conv => {
      const convID = ChatTypes.stringToConversationIDKey(conv.convID)
      channelInfos[convID] = Constants.makeChannelInfo({
        channelname: conv.channel,
        description: conv.headline,
        hasAllMembers: null,
        memberStatus: conv.memberStatus,
        mtime: conv.time,
        numParticipants: (conv.participants || []).length,
      })
    })

    return TeamsGen.createSetTeamChannels({channelInfos: I.Map(channelInfos), teamname})
  })
}

function* getTeams(
  state: TypedState,
  _: ConfigGen.BootstrapStatusLoadedPayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload,
  logger: Saga.SagaLogger
) {
  const username = state.config.username
  if (!username) {
    logger.warn('getTeams while logged out')
    return
  }
  try {
    const results: Saga.RPCPromiseType<
      typeof RPCTypes.teamsTeamListUnverifiedRpcPromise
    > = yield RPCTypes.teamsTeamListUnverifiedRpcPromise(
      {includeImplicitTeams: false, userAssertion: username},
      Constants.teamsLoadedWaitingKey
    )

    const teams: Array<RPCTypes.AnnotatedMemberInfo> = results.teams || []
    const teamnames: Array<string> = []
    const teammembercounts: {[key: string]: number} = {}
    const teamNameToRole: {[K in Types.Teamname]: Types.MaybeTeamRoleType} = {}
    const teamNameToIsOpen: {[key: string]: boolean} = {}
    const teamNameToAllowPromote: {[key: string]: boolean} = {}
    const teamNameToIsShowcasing: {[key: string]: boolean} = {}
    const teamNameToID: {[key: string]: string} = {}
    teams.forEach(team => {
      teamnames.push(team.fqName)
      teammembercounts[team.fqName] = team.memberCount
      teamNameToRole[team.fqName] = Constants.teamRoleByEnum[team.role] || 'none'
      teamNameToIsOpen[team.fqName] = team.isOpenTeam
      teamNameToAllowPromote[team.fqName] = team.allowProfilePromote
      teamNameToIsShowcasing[team.fqName] = team.isMemberShowcased
      teamNameToID[team.fqName] = team.teamID
    })

    // Dismiss any stale badges for teams we're no longer in
    const teamResetUsers = state.teams.teamNameToResetUsers || I.Map()
    const teamNameSet = I.Set<string>(teamnames)
    const dismissIDs = teamResetUsers.reduce<Array<string>>(
      (ids, value: I.Set<Types.ResetUser>, key: string) => {
        if (!teamNameSet.has(key)) {
          ids.push(...value.toArray().map(ru => ru.badgeIDKey))
        }
        return ids
      },
      []
    )
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
        teamNameToAllowPromote: I.Map(teamNameToAllowPromote),
        teamNameToID: I.Map(teamNameToID),
        teamNameToIsOpen: I.Map(teamNameToIsOpen),
        teamNameToIsShowcasing: I.Map(teamNameToIsShowcasing),
        teamNameToRole: I.Map(teamNameToRole),
        teammembercounts: I.Map(teammembercounts),
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

const checkRequestedAccess = (_: TypedState) =>
  RPCTypes.teamsTeamListMyAccessRequestsRpcPromise({}, Constants.teamsAccessRequestWaitingKey).then(
    result => {
      const teams = (result || []).map(row => (row && row.parts ? row.parts.join('.') : ''))
      return TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: I.Set(teams)})
    }
  )

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
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  try {
    const result: Saga.RPCPromiseType<
      typeof RPCChatTypes.localNewConversationLocalRpcPromise
    > = yield RPCChatTypes.localNewConversationLocalRpcPromise(
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

const setMemberPublicity = (_: TypedState, action: TeamsGen.SetMemberPublicityPayload) => {
  const {teamname, showcase} = action.payload
  return RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
    {
      isShowcased: showcase,
      name: teamname,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => [
      TeamsGen.createGetDetails({teamname}),
      // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
      TeamsGen.createGetTeams(),
    ])
    .catch(() =>
      // TODO handle error, but for now make sure loading is unset
      [
        TeamsGen.createGetDetails({teamname}),
        // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
        TeamsGen.createGetTeams(),
      ]
    )
}

function* setPublicity(state: TypedState, action: TeamsGen.SetPublicityPayload) {
  const {teamname, settings} = action.payload
  const waitingKey = Constants.settingsWaitingKey(teamname)

  const teamSettings = state.teams.getIn(
    ['teamNameToSettings', teamname],
    Constants.makeTeamSettings({
      joinAs: RPCTypes.TeamRole['reader'],
      open: false,
    })
  )

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
      Saga.callUntyped(() =>
        RPCTypes.teamsTeamSetSettingsRpcPromise(
          {
            name: teamname,
            settings: {
              joinAs: RPCTypes.TeamRole[settings.openTeamRole],
              open: settings.openTeam,
            },
          },
          waitingKey
        )
          .then(payload => ({payload, type: 'ok'}))
          .catch(payload => ({payload, type: 'error'}))
      )
    )
  }
  if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
    calls.push(
      Saga.callUntyped(() =>
        RPCTypes.teamsSetTarsDisabledRpcPromise(
          {
            disabled: settings.ignoreAccessRequests,
            name: teamname,
          },
          waitingKey
        )
          .then(payload => ({payload, type: 'ok'}))
          .catch(payload => ({payload, type: 'error'}))
      )
    )
  }
  if (publicityAnyMember !== settings.publicityAnyMember) {
    calls.push(
      Saga.callUntyped(() =>
        RPCTypes.teamsSetTeamShowcaseRpcPromise(
          {
            anyMemberShowcase: settings.publicityAnyMember,
            name: teamname,
          },
          waitingKey
        )
          .then(payload => ({payload, type: 'ok'}))
          .catch(payload => ({payload, type: 'error'}))
      )
    )
  }
  if (publicityMember !== settings.publicityMember) {
    calls.push(
      Saga.callUntyped(() =>
        RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
          {
            isShowcased: settings.publicityMember,
            name: teamname,
          },
          waitingKey
        )
          .then(payload => ({payload, type: 'ok'}))
          .catch(payload => ({payload, type: 'error'}))
      )
    )
  }
  if (publicityTeam !== settings.publicityTeam) {
    calls.push(
      Saga.callUntyped(() =>
        RPCTypes.teamsSetTeamShowcaseRpcPromise(
          {
            isShowcased: settings.publicityTeam,
            name: teamname,
          },
          waitingKey
        )
          .then(payload => ({payload, type: 'ok'}))
          .catch(payload => ({payload, type: 'error'}))
      )
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

const teamChangedByName = (
  _: TypedState,
  action: EngineGen.Keybase1NotifyTeamTeamChangedByNamePayload,
  logger
) => {
  const {teamName} = action.payload.params
  logger.info(`Got teamChanged for ${teamName} from service`)
  const selectedTeamNames = Constants.getSelectedTeamNames()
  if (selectedTeamNames.includes(teamName) && _wasOnTeamsTab()) {
    // only reload if that team is selected
    return [TeamsGen.createGetTeams(), TeamsGen.createGetDetails({teamname: teamName})]
  }
  return getLoadCalls()
}

const teamDeletedOrExit = (
  state,
  action: EngineGen.Keybase1NotifyTeamTeamDeletedPayload | EngineGen.Keybase1NotifyTeamTeamExitPayload
) => {
  const {teamID} = action.payload.params
  const selectedTeamNames = Constants.getSelectedTeamNames()
  const toFind = Constants.getTeamNameFromID(state, teamID)
  if (toFind && selectedTeamNames.includes(toFind)) {
    return [RouteTreeGen.createNavUpToScreen({routeName: 'teamsRoot'}), ...getLoadCalls()]
  }
  return getLoadCalls()
}

const getLoadCalls = (teamname?: string) => [
  ...(_wasOnTeamsTab() ? [TeamsGen.createGetTeams()] : []),
  ...(teamname ? [TeamsGen.createGetDetails({teamname})] : []),
]

const updateTopic = (_: TypedState, action: TeamsGen.UpdateTopicPayload) => {
  const {teamname, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  return RPCChatTypes.localPostHeadlineRpcPromise(param, Constants.teamWaitingKey(teamname)).then(() =>
    TeamsGen.createSetUpdatedTopic({conversationIDKey, newTopic, teamname})
  )
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
      `${logPrefix} Existing list longer than list in gregor state, got list with length ${
        teams.length
      } when we have ${existingTeams.size} already. Bailing on update.`
    )
    return
  }
  teams.push(teamname)
  // make sure there're no dupes
  teams = I.Set(teams).toArray()

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

const updateChannelname = (_: TypedState, action: TeamsGen.UpdateChannelNamePayload) => {
  const {teamname, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  return RPCChatTypes.localPostMetadataRpcPromise(param, Constants.teamWaitingKey(teamname))
    .then(() => TeamsGen.createSetUpdatedChannelName({conversationIDKey, newChannelName, teamname}))
    .catch(error => TeamsGen.createSetChannelCreationError({error: error.desc}))
}

const deleteChannelConfirmed = (_: TypedState, action: TeamsGen.DeleteChannelConfirmedPayload) => {
  const {teamname, conversationIDKey} = action.payload
  // channelName is only needed for confirmation, so since we handle
  // confirmation ourselves we don't need to plumb it through.
  return RPCChatTypes.localDeleteConversationLocalRpcPromise(
    {
      channelName: '',
      confirmed: true,
      convID: ChatTypes.keyToConversationID(conversationIDKey),
    },
    Constants.teamWaitingKey(teamname)
  ).then(() => TeamsGen.createDeleteChannelInfo({conversationIDKey, teamname}))
}

const getMembers = (_: TypedState, action: TeamsGen.GetMembersPayload, logger: Saga.SagaLogger) => {
  const {teamname} = action.payload
  return RPCTypes.teamsTeamGetMembersRpcPromise({
    name: teamname,
  })
    .then(res => {
      const members = Constants.rpcDetailsToMemberInfos(res)
      return TeamsGen.createSetMembers({members, teamname})
    })
    .catch(error => {
      logger.error(`Error updating members for ${teamname}: ${error.desc}`)
    })
}

const badgeAppForTeams = (state: TypedState, action: TeamsGen.BadgeAppForTeamsPayload) => {
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    // Don't make any calls we don't have permission to.
    return
  }

  let actions: Array<TypedActions> = []
  const deletedTeams = I.List(action.payload.deletedTeams || [])
  // TODO ts-migration remove any
  const newTeams: I.Set<any> = I.Set(action.payload.newTeamNames || [])
  // TODO ts-migration remove any
  const newTeamRequests: I.List<any> = I.List(action.payload.newTeamAccessRequests || [])

  // TODO ts-migration remove any
  const teamsWithResetUsers: I.List<any> = I.List(action.payload.teamsWithResetUsers || [])
  const teamsWithResetUsersMap = teamsWithResetUsers.reduce((res, entry) => {
    if (!res[entry.teamname]) {
      res[entry.teamname] = I.Set()
    }
    res[entry.teamname] = res[entry.teamname].add(
      Constants.makeResetUser({
        badgeIDKey: Constants.resetUserBadgeIDToKey(entry.id),
        username: entry.username,
      })
    )
    return res
  }, {})

  if (_wasOnTeamsTab() && (newTeams.size > 0 || newTeamRequests.size > 0 || deletedTeams.size > 0)) {
    // Call getTeams if new teams come in.
    // Covers the case when we're staring at the teams page so
    // we don't miss a notification we clear when we tab away
    const existingNewTeams = state.teams.getIn(['newTeams'], I.Set())
    const existingNewTeamRequests = state.teams.getIn(['newTeamRequests'], I.List())
    if (!newTeams.equals(existingNewTeams) && newTeams.size > 0) {
      // We have been added to a new team & we need to refresh the list
      actions.push(TeamsGen.createGetTeams())
    }

    // getDetails for teams that have new access requests
    // Covers case where we have a badge appear on the requests
    // tab with no rows showing up
    const newTeamRequestsSet = I.Set(newTeamRequests)
    // TODO ts-migration remove any
    const existingNewTeamRequestsSet = I.Set(existingNewTeamRequests)
    // TODO ts-migration remove any
    const toLoad: I.Set<any> = newTeamRequestsSet.subtract(existingNewTeamRequestsSet)
    const loadingCalls = toLoad.map(teamname => TeamsGen.createGetDetails({teamname})).toArray()
    actions = actions.concat(loadingCalls)
  }

  // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
  actions.push(
    TeamsGen.createSetNewTeamInfo({
      deletedTeams,
      newTeamRequests,
      newTeams,
      teamNameToResetUsers: I.Map(teamsWithResetUsersMap),
    })
  )
  return actions
}

let _wasOnTeamsTab = () => Constants.isOnTeamsTab()

const receivedBadgeState = (_: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  TeamsGen.createBadgeAppForTeams({
    // @ts-ignore codemod-issue
    deletedTeams: action.payload.badgeState.deletedTeams || [],
    // @ts-ignore codemod-issue
    newTeamAccessRequests: action.payload.badgeState.newTeamAccessRequests || [],
    // @ts-ignore codemod-issue
    newTeamNames: action.payload.badgeState.newTeamNames || [],
    teamsWithResetUsers: action.payload.badgeState.teamsWithResetUsers || [],
  })

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
    ? I.Set(JSON.parse(teamsWithChosenChannelsStr))
    : I.Set()
  actions.push(TeamsGen.createSetTeamsWithChosenChannels({teamsWithChosenChannels}))

  return actions
}

const renameTeam = (_: TypedState, action: TeamsGen.RenameTeamPayload) => {
  const {newName: _newName, oldName} = action.payload
  const prevName = {parts: oldName.split('.')}
  const newName = {parts: _newName.split('.')}
  return RPCTypes.teamsTeamRenameRpcPromise({newName, prevName}, Constants.teamRenameWaitingKey).catch(
    () => {} // err displayed from waiting store in component
  )
}

const clearNavBadges = () =>
  RPCTypes.gregorDismissCategoryRpcPromise({
    category: 'team.newly_added_to_team',
  })
    .then(() =>
      RPCTypes.gregorDismissCategoryRpcPromise({
        category: 'team.request_access',
      })
    )
    .then(() => RPCTypes.gregorDismissCategoryRpcPromise({category: 'team.delete'}))
    .catch(err => logError(err))

function addThemToTeamFromTeamBuilder(
  state: TypedState,
  {payload: {teamname}}: TeamBuildingGen.FinishedTeamBuildingPayload,
  logger: Saga.SagaLogger
) {
  if (!teamname) {
    logger.error("Trying to add them to a team, but I don't know what the teamname is.")
    return
  }

  const role = state.teams.teamBuilding.teamBuildingFinishedSelectedRole
  const sendChatNotification = state.teams.teamBuilding.teamBuildingFinishedSendNotification

  return state.teams.teamBuilding.teamBuildingFinishedTeam.toArray().map(user =>
    TeamsGen.createAddToTeam({
      role,
      sendChatNotification,
      teamname,
      username: user.id,
    })
  )
}

function* teamBuildingSaga(): Saga.SagaGenerator<any, any> {
  yield* commonTeamBuildingSaga('teams')

  yield* Saga.chainAction2(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('teams', addThemToTeamFromTeamBuilder)
  )
}

const teamsSaga = function*(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(TeamsGen.leaveTeam, leaveTeam, 'leaveTeam')
  yield* Saga.chainGenerator<TeamsGen.DeleteTeamPayload>(TeamsGen.deleteTeam, deleteTeam, 'deleteTeam')
  yield* Saga.chainAction2(TeamsGen.getTeamProfileAddList, getTeamProfileAddList, 'getTeamProfileAddList')
  yield* Saga.chainAction2(TeamsGen.leftTeam, leftTeam, 'leftTeam')
  yield* Saga.chainGenerator<TeamsGen.CreateNewTeamPayload>(
    TeamsGen.createNewTeam,
    createNewTeam,
    'createNewTeam'
  )
  yield* Saga.chainGenerator<TeamsGen.JoinTeamPayload>(TeamsGen.joinTeam, joinTeam, 'joinTeam')
  yield* Saga.chainGenerator<TeamsGen.GetDetailsPayload>(TeamsGen.getDetails, getDetails, 'getDetails')
  yield* Saga.chainAction2(TeamsGen.getMembers, getMembers, 'getMembers')
  yield* Saga.chainAction2(TeamsGen.getDetailsForAllTeams, getDetailsForAllTeams, 'getDetailsForAllTeams')
  yield* Saga.chainGenerator<TeamsGen.GetTeamPublicityPayload>(
    TeamsGen.getTeamPublicity,
    getTeamPublicity,
    'getTeamPublicity'
  )
  yield* Saga.chainAction2(TeamsGen.getTeamOperations, getTeamOperations, 'getTeamOperations')
  yield* Saga.chainGenerator<TeamsGen.CreateNewTeamFromConversationPayload>(
    TeamsGen.createNewTeamFromConversation,
    createNewTeamFromConversation,
    'createNewTeamFromConversation'
  )
  yield* Saga.chainAction2(TeamsGen.getChannelInfo, getChannelInfo, 'getChannelInfo')
  yield* Saga.chainAction2(TeamsGen.getChannels, getChannels, 'getChannels')
  yield* Saga.chainGenerator<
    ConfigGen.BootstrapStatusLoadedPayload | TeamsGen.GetTeamsPayload | TeamsGen.LeftTeamPayload
  >([ConfigGen.bootstrapStatusLoaded, TeamsGen.getTeams, TeamsGen.leftTeam], getTeams, 'getTeams')
  yield* Saga.chainGenerator<TeamsGen.SaveChannelMembershipPayload>(
    TeamsGen.saveChannelMembership,
    saveChannelMembership,
    'saveChannelMembership'
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
  yield* Saga.chainAction2(TeamsGen.badgeAppForTeams, badgeAppForTeams, 'badgeAppForTeams')
  yield* Saga.chainAction2(TeamsGen.badgeAppForTeams, badgeAppForTeams, 'badgeAppForTeams')
  yield* Saga.chainAction2(TeamsGen.inviteToTeamByPhone, inviteToTeamByPhone, 'inviteToTeamByPhone')
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
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState, 'receivedBadgeState')
  yield* Saga.chainAction2(GregorGen.pushState, gregorPushState, 'gregorPushState')
  yield* Saga.chainAction2(
    EngineGen.keybase1NotifyTeamTeamChangedByName,
    teamChangedByName,
    'teamChangedByName'
  )
  yield* Saga.chainAction2(
    [EngineGen.keybase1NotifyTeamTeamDeleted, EngineGen.keybase1NotifyTeamTeamExit],
    teamDeletedOrExit,
    'teamDeletedOrExit'
  )

  yield* Saga.chainAction2(TeamsGen.clearNavBadges, clearNavBadges)

  // Hook up the team building sub saga
  yield* teamBuildingSaga()
}

export default teamsSaga

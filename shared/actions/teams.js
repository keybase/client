// @flow
import logger from '../logger'
import {map, last, upperFirst} from 'lodash-es'
import * as I from 'immutable'
import * as SearchGen from './search-gen'
import * as GregorGen from './gregor-gen'
import * as TeamsGen from './teams-gen'
import * as Types from '../constants/types/teams'
import * as Constants from '../constants/teams'
import * as ChatConstants from '../constants/chat2'
import * as ChatTypes from '../constants/types/chat2'
import * as SearchConstants from '../constants/search'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as RouteTypes from '../constants/types/route-tree'
import * as RouteConstants from '../constants/route-tree'
import * as Chat2Gen from './chat2-gen'
import engine from '../engine'
import {usernameSelector} from '../constants/selectors'
import {isMobile} from '../constants/platform'
import {putActionIfOnPath, navigateTo} from './route-tree'
import {chatTab, teamsTab} from '../constants/tabs'
import openSMS from '../util/sms'
import {createDecrementWaiting, createIncrementWaiting} from '../actions/waiting-gen'
import {createGlobalError} from '../actions/config-gen'
import {convertToError, logError} from '../util/errors'

import type {TypedState} from '../constants/reducer'

const _createNewTeam = function*(action: TeamsGen.CreateNewTeamPayload) {
  const {destSubPath, joinSubteam, rootPath, sourceSubPath, teamname} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: true}))
  try {
    yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
      joinSubteam,
      name: teamname,
    })

    // Dismiss the create team dialog.
    yield Saga.put(
      putActionIfOnPath(rootPath.concat(sourceSubPath), navigateTo(destSubPath, rootPath), rootPath)
    )

    // No error if we get here.
    yield Saga.put(navigateTo([isMobile ? chatTab : teamsTab]))
  } catch (error) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
  } finally {
    yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: false}))
  }
}

const _joinTeam = function*(action: TeamsGen.JoinTeamPayload) {
  const {teamname} = action.payload
  yield Saga.all([
    Saga.put(TeamsGen.createSetTeamJoinError({error: ''})),
    Saga.put(TeamsGen.createSetTeamJoinSuccess({success: false, teamname: ''})),
  ])
  try {
    const result = yield Saga.call(RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise, {
      tokenOrName: teamname,
    })

    // Success
    yield Saga.put(
      TeamsGen.createSetTeamJoinSuccess({
        success: true,
        teamname: result && result.wasTeamName ? teamname : '',
      })
    )
  } catch (error) {
    const desc =
      error.code === RPCTypes.constantsStatusCode.scteaminvitebadtoken
        ? 'Sorry, that team name or token is not valid.'
        : error.desc
    yield Saga.put(TeamsGen.createSetTeamJoinError({error: desc}))
  }
}

const _leaveTeam = function(action: TeamsGen.LeaveTeamPayload) {
  const {teamname} = action.payload
  return Saga.call(RPCTypes.teamsTeamLeaveRpcPromise, {
    name: teamname,
    permanent: false,
  })
}

const _addPeopleToTeam = function*(action: TeamsGen.AddPeopleToTeamPayload) {
  const {destSubPath, role, rootPath, sendChatNotification, sourceSubPath, teamname} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  const state: TypedState = yield Saga.select()
  const ids = SearchConstants.getUserInputItemIds(state, {searchKey: 'addToTeamSearch'})
  const collectedErrors = []
  for (const id of ids) {
    try {
      yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
        name: teamname,
        email: '',
        username: id,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
        sendChatNotification,
      })
    } catch (error) {
      if (error.desc === 'You cannot invite an owner to a team.') {
        // This error comes through as error code scgeneric, so if we want
        // to rewrite it we have to match on the string itself.
        const [username, service] = id.split('@')
        collectedErrors.push(
          `${upperFirst(
            service
          )} user @${username} doesn't have a Keybase account yet, so you can't add them as an owner; you can add them as reader or writer.`
        )
      } else {
        collectedErrors.push(`Error adding ${id}: ${error.desc}`)
      }
    }
  }
  if (collectedErrors.length === 0) {
    // Success, dismiss the create team dialog.
    yield Saga.put(
      putActionIfOnPath(rootPath.concat(sourceSubPath), navigateTo(destSubPath, rootPath), rootPath)
    )
  } else {
    yield Saga.put(TeamsGen.createSetTeamInviteError({error: collectedErrors.join('\n')}))
  }
  yield Saga.put(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
  yield Saga.put(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
  yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
}

const _getTeamRetentionPolicy = function*(action: TeamsGen.GetTeamRetentionPolicyPayload) {
  const {teamname} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  const state: TypedState = yield Saga.select()
  const teamID = Constants.getTeamID(state, teamname)
  if (!teamID) {
    const errMsg = `getTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    return
  }
  const policy: RPCChatTypes.RetentionPolicy = yield Saga.call(
    RPCChatTypes.localGetTeamRetentionLocalRpcPromise,
    {teamID}
  )
  let retentionPolicy: Types.RetentionPolicy = Constants.makeRetentionPolicy()
  try {
    retentionPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(policy)
    if (retentionPolicy.type === 'inherit') {
      throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
    }
  } catch (err) {
    logger.error(err.message)
    throw err
  } finally {
    yield Saga.sequentially([
      Saga.put(TeamsGen.createSetTeamRetentionPolicy({teamname, retentionPolicy})),
      Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)})),
    ])
  }
}

const _saveTeamRetentionPolicy = function(
  action: TeamsGen.SaveTeamRetentionPolicyPayload,
  state: TypedState
) {
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
  return Saga.sequentially([
    Saga.put(
      createIncrementWaiting({
        key: [Constants.teamWaitingKey(teamname), Constants.retentionWaitingKey(teamname)],
      })
    ),
    Saga.call(RPCChatTypes.localSetTeamRetentionLocalRpcPromise, {teamID, policy: servicePolicy}),
    Saga.put(
      createDecrementWaiting({
        key: [Constants.teamWaitingKey(teamname), Constants.retentionWaitingKey(teamname)],
      })
    ),
  ])
}

const _updateTeamRetentionPolicy = function(
  action: Chat2Gen.UpdateTeamRetentionPolicyPayload,
  state: TypedState
) {
  const {convs} = action.payload
  if (convs.length === 0) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetention, name} = convs[0]
  try {
    const newPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(teamRetention)
    return Saga.put(TeamsGen.createSetTeamRetentionPolicy({teamname: name, retentionPolicy: newPolicy}))
  } catch (err) {
    logger.error(err.message)
    throw err
  }
}

const _inviteByEmail = function*(action: TeamsGen.InviteToTeamByEmailPayload) {
  const {invitees, role, teamname} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({teamname, invitees, loadingInvites: true}))
  try {
    const res: RPCTypes.BulkRes = yield Saga.call(RPCTypes.teamsTeamAddEmailsBulkRpcPromise, {
      name: teamname,
      emails: invitees,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
    })
    if (res.malformed && res.malformed.length > 0) {
      throw new Error(`Unable to parse email addresses: ${res.malformed.join('; ')}`)
    }
  } finally {
    // TODO handle error
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({teamname, invitees, loadingInvites: false}))
  }
}

const _addToTeam = function*(action: TeamsGen.AddToTeamPayload) {
  const {teamname, username, role, sendChatNotification} = action.payload
  const waitingKeys = [Constants.teamWaitingKey(teamname), Constants.addMemberWaitingKey(teamname, username)]
  yield Saga.put(createIncrementWaiting({key: waitingKeys}))
  try {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      name: teamname,
      username,
      email: '',
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
    })
  } finally {
    // TODO handle error
    yield Saga.put(createDecrementWaiting({key: waitingKeys}))
  }
}

const _editDescription = function*(action: TeamsGen.EditTeamDescriptionPayload) {
  const {teamname, description} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
      description,
      name: teamname,
    })
  } finally {
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    // TODO We don't get a team changed notification for this. Delete this call when CORE-7125 is finished.
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname})))
  }
}

const _editMembership = function*(action: TeamsGen.EditMembershipPayload) {
  const {teamname, username, role} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsTeamEditMemberRpcPromise, {
      name: teamname,
      username,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
    })
  } finally {
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  }
}

const _removeMemberOrPendingInvite = function*(action: TeamsGen.RemoveMemberOrPendingInvitePayload) {
  const {teamname, username, email, inviteID} = action.payload

  const invitees = username || email || inviteID
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({teamname, invitees, loadingInvites: true}))

  // disallow call with any pair of username, email, and ID to avoid black-bar errors
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  // only one of (username, email, inviteID) is truth-y
  const waitingKeys = [
    Constants.teamWaitingKey(teamname),
    Constants.removeMemberWaitingKey(teamname, username || email || inviteID),
  ]
  yield Saga.put(createIncrementWaiting({key: waitingKeys}))
  try {
    yield Saga.call(RPCTypes.teamsTeamRemoveMemberRpcPromise, {email, name: teamname, username, inviteID})
  } finally {
    yield Saga.put(createDecrementWaiting({key: waitingKeys}))
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({teamname, invitees, loadingInvites: false}))
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

const _inviteToTeamByPhone = function*(action: TeamsGen.InviteToTeamByPhonePayload) {
  const {teamname, role, phoneNumber, fullName = ''} = action.payload
  const seitan = yield Saga.call(RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise, {
    name: teamname,
    role: (!!role && RPCTypes.teamsTeamRole[role]) || 0,
    label: {t: 1, sms: ({f: fullName || '', n: phoneNumber}: RPCTypes.SeitanKeyLabelSms)},
  })

  /* Open SMS */
  const bodyText = generateSMSBody(teamname, seitan)
  openSMS([phoneNumber], bodyText).catch(err => logger.info('Error sending SMS', err))

  yield Saga.put(TeamsGen.createGetDetails({teamname}))
}

const _ignoreRequest = function*(action: TeamsGen.IgnoreRequestPayload) {
  const {teamname, username} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsTeamIgnoreRequestRpcPromise, {
      name: teamname,
      username,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    // TODO get rid of this once core sends us a notification for this (CORE-7125)
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
  }
}

const _createNewTeamFromConversation = function*(
  action: TeamsGen.CreateNewTeamFromConversationPayload
): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, teamname} = action.payload
  const state: TypedState = yield Saga.select()
  const me = usernameSelector(state)
  let participants: Array<string> = []

  if (state.chat2.pendingSelected) {
    participants = state.chat2.pendingConversationUsers.toArray()
  } else {
    const meta = ChatConstants.getMeta(state, conversationIDKey)
    participants = meta.participants.toArray()
  }

  if (participants) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
    yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: true}))
    try {
      const createRes = yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
        joinSubteam: false,
        name: teamname,
      })
      for (const username of participants) {
        if (!createRes.creatorAdded || username !== me) {
          yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
            email: '',
            name: teamname,
            role: username === me ? RPCTypes.teamsTeamRole.admin : RPCTypes.teamsTeamRole.writer,
            sendChatNotification: true,
            username,
          })
        }
      }
      yield Saga.put(Chat2Gen.createStartConversation({tlf: `/keybase/team/${teamname}`}))
      if (state.chat2.pendingSelected) {
        yield Saga.put(Chat2Gen.createExitSearch({canceled: true}))
        yield Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'}))
      }
    } catch (error) {
      yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
    } finally {
      yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: false}))
    }
  }
}

const _getDetails = function*(action: TeamsGen.GetDetailsPayload): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  yield Saga.put(TeamsGen.createGetTeamOperations({teamname}))
  yield Saga.put(TeamsGen.createGetTeamPublicity({teamname}))
  try {
    const unsafeDetails: RPCTypes.TeamDetails = yield Saga.call(RPCTypes.teamsTeamGetRpcPromise, {
      forceRepoll: false,
      name: teamname,
    })

    // Don't allow the none default
    const details: RPCTypes.TeamDetails = {
      ...unsafeDetails,
      settings: {
        ...unsafeDetails.settings,
        joinAs:
          unsafeDetails.settings.joinAs === RPCTypes.teamsTeamRole.none
            ? RPCTypes.teamsTeamRole.reader
            : unsafeDetails.settings.joinAs,
      },
    }

    // Get requests to join
    let requests: RPCTypes.TeamJoinRequest[] = []
    const state = yield Saga.select()
    if (Constants.getCanPerform(state, teamname).manageMembers) {
      // TODO (DESKTOP-6478) move this somewhere else
      requests = yield Saga.call(RPCTypes.teamsTeamListRequestsRpcPromise, {
        teamName: teamname,
      })
    }
    requests.sort((a, b) => a.username.localeCompare(b.username))

    const requestMap = requests.reduce((reqMap, req) => {
      if (!reqMap[req.name]) {
        reqMap[req.name] = I.Set()
      }
      reqMap[req.name] = reqMap[req.name].add(Constants.makeRequestInfo({username: req.username}))
      return reqMap
    }, {})

    const infos = []
    const types: Types.TeamRoleType[] = ['reader', 'writer', 'admin', 'owner']
    const typeToKey: Types.TypeMap = {
      reader: 'readers',
      writer: 'writers',
      admin: 'admins',
      owner: 'owners',
    }
    types.forEach(type => {
      const key = typeToKey[type]
      const members = details.members[key] || []
      members.forEach(({active, fullName, username}) => {
        infos.push([
          username,
          Constants.makeMemberInfo({
            active,
            fullName,
            type,
            username,
          }),
        ])
      })
    })

    const invites = map(details.annotatedActiveInvites, (invite: RPCTypes.AnnotatedTeamInvite) => {
      const role = Constants.teamRoleByEnum[invite.role]
      if (role === 'none') {
        return null
      }
      const username = (() => {
        const t = invite.type
        if (t.c !== RPCTypes.teamsTeamInviteCategory.sbs) {
          return ''
        }
        // $ForceType
        const sbs: RPCTypes.TeamInviteSocialNetwork = t.sbs || ''
        return `${invite.name}@${sbs}`
      })()
      return Constants.makeInviteInfo({
        email: invite.type.c === RPCTypes.teamsTeamInviteCategory.email ? invite.name : '',
        name: invite.type.c === RPCTypes.teamsTeamInviteCategory.seitan ? invite.name : '',
        role,
        username,
        id: invite.id,
      })
    }).filter(Boolean)

    // if we have no requests for this team, make sure we don't hold on to any old ones
    if (!requestMap[teamname]) {
      yield Saga.put(TeamsGen.createClearTeamRequests({teamname}))
    }

    // Get the subteam map for this team.
    const teamTree = yield Saga.call(RPCTypes.teamsTeamTreeRpcPromise, {
      name: {parts: teamname.split('.')},
    })
    const subteams = teamTree.entries.map(team => team.name.parts.join('.')).filter(team => team !== teamname)

    yield Saga.put(
      TeamsGen.createSetTeamDetails({
        teamname,
        members: I.Map(infos),
        settings: Constants.makeTeamSettings(details.settings),
        invites: I.Set(invites),
        subteams: I.Set(subteams),
        requests: I.Map(requestMap),
      })
    )
  } finally {
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  }
}

const _getTeamOperations = function*(
  action: TeamsGen.GetTeamOperationsPayload
): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname

  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    const teamOperation = yield Saga.call(RPCTypes.teamsCanUserPerformRpcPromise, {
      name: teamname,
    })
    yield Saga.put(TeamsGen.createSetTeamCanPerform({teamname, teamOperation}))
  } finally {
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  }
}

const _getTeamPublicity = function*(action: TeamsGen.GetTeamPublicityPayload): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  const state: TypedState = yield Saga.select()
  const yourOperations = Constants.getCanPerform(state, teamname)

  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  // Get publicity settings for this team.
  const publicity: RPCTypes.TeamAndMemberShowcase = yield Saga.call(
    RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise,
    {
      name: teamname,
    }
  )

  let tarsDisabled = false
  // Find out whether team access requests are enabled. Throws if you aren't admin.
  if (yourOperations.changeTarsDisabled) {
    tarsDisabled = yield Saga.call(RPCTypes.teamsGetTarsDisabledRpcPromise, {
      name: teamname,
    })
  }

  const publicityMap = {
    anyMemberShowcase: publicity.teamShowcase.anyMemberShowcase,
    description: publicity.teamShowcase.description || '',
    ignoreAccessRequests: tarsDisabled,
    member: publicity.isMemberShowcased,
    team: publicity.teamShowcase.isShowcased,
  }

  yield Saga.put(TeamsGen.createSetTeamPublicitySettings({teamname, publicity: publicityMap}))
  yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
}

function _getChannels(action: TeamsGen.GetChannelsPayload) {
  const teamname = action.payload.teamname
  const waitingKey = {key: Constants.getChannelsWaitingKey(teamname)}
  return Saga.all([
    Saga.call(RPCChatTypes.localGetTLFConversationsLocalRpcPromise, {
      membersType: RPCChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      topicType: RPCChatTypes.commonTopicType.chat,
    }),
    Saga.identity(teamname),
    Saga.identity(waitingKey),
    Saga.put(createIncrementWaiting(waitingKey)),
  ])
}

function _afterGetChannels(fromGetChannels: any[]) {
  const results: RPCChatTypes.GetTLFConversationsLocalRes = fromGetChannels[0]
  const teamname: string = fromGetChannels[1]
  const waitingKey: {|key: string|} = fromGetChannels[2]

  const convs = results.convs || []
  const channelInfos: {[ChatTypes.ConversationIDKey]: Types.ChannelInfo} = {}
  convs.forEach(conv => {
    const convID = ChatTypes.stringToConversationIDKey(conv.convID)
    channelInfos[convID] = Constants.makeChannelInfo({
      channelname: conv.channel,
      description: conv.headline,
      participants: I.Set(conv.participants || []),
    })
  })

  return Saga.all([
    Saga.put(TeamsGen.createSetTeamChannels({teamname, channelInfos: I.Map(channelInfos)})),
    Saga.put(createDecrementWaiting(waitingKey)),
  ])
}

const _getTeams = function*(action: TeamsGen.GetTeamsPayload): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const username = usernameSelector(state)
  if (!username) {
    logger.warn('getTeams while logged out')
    return
  }
  yield Saga.put(TeamsGen.createSetLoaded({loaded: false}))
  try {
    const results: RPCTypes.AnnotatedTeamList = yield Saga.call(RPCTypes.teamsTeamListUnverifiedRpcPromise, {
      includeImplicitTeams: false,
      userAssertion: username,
    })

    const teams = results.teams || []
    const teamnames = []
    const teammembercounts = {}
    const teamNameToRole: {[Types.Teamname]: Types.MaybeTeamRoleType} = {}
    const teamNameToIsOpen = {}
    const teamNameToAllowPromote = {}
    const teamNameToIsShowcasing = {}
    const teamNameToID = {}
    teams.forEach(team => {
      teamnames.push(team.fqName)
      teammembercounts[team.fqName] = team.memberCount
      teamNameToRole[team.fqName] = Constants.teamRoleByEnum[team.role]
      teamNameToIsOpen[team.fqName] = team.isOpenTeam
      teamNameToAllowPromote[team.fqName] = team.allowProfilePromote
      teamNameToIsShowcasing[team.fqName] = team.isMemberShowcased
      teamNameToID[team.fqName] = team.teamID
    })

    // Dismiss any stale badges for teams we're no longer in
    const teamResetUsers = state.teams.getIn(['teamNameToResetUsers'], I.Map())
    const teamNameSet = I.Set(teamnames)
    const dismissIDs = teamResetUsers.reduce((ids, value: I.Set<Types.ResetUser>, key: string) => {
      if (!teamNameSet.has(key)) {
        ids.push(...value.toArray().map(ru => ru.badgeIDKey))
      }
      return ids
    }, [])
    yield Saga.all(
      dismissIDs.map(id =>
        Saga.call(RPCTypes.gregorDismissItemRpcPromise, {id: Constants.keyToResetUserBadgeID(id)})
      )
    )

    yield Saga.put(
      TeamsGen.createSetTeamInfo({
        teamnames: teamNameSet,
        teammembercounts: I.Map(teammembercounts),
        teamNameToIsOpen: I.Map(teamNameToIsOpen),
        teamNameToRole: I.Map(teamNameToRole),
        teamNameToAllowPromote: I.Map(teamNameToAllowPromote),
        teamNameToIsShowcasing: I.Map(teamNameToIsShowcasing),
        teamNameToID: I.Map(teamNameToID),
      })
    )
  } catch (err) {
    if (err.code === RPCTypes.constantsStatusCode.scapinetworkerror) {
      // Ignore API errors due to offline
    } else {
      throw err
    }
  } finally {
    yield Saga.put(TeamsGen.createSetLoaded({loaded: true}))
  }
}

const _checkRequestedAccess = (action: TeamsGen.CheckRequestedAccessPayload) =>
  Saga.call(RPCTypes.teamsTeamListMyAccessRequestsRpcPromise, {})

function _checkRequestedAccessSuccess(result) {
  const teams = (result || []).map(row => row.parts.join('.'))
  return Saga.put(TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: I.Set(teams)}))
}

const _joinConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield Saga.call(RPCChatTypes.localJoinConversationByIDLocalRpcPromise, {
      convID,
    })
    yield Saga.put(
      TeamsGen.createAddParticipant({
        teamname,
        conversationIDKey,
        participant,
      })
    )
  } catch (error) {
    yield Saga.put(createGlobalError({globalError: convertToError(error)}))
  }
}

const _leaveConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield Saga.call(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
      convID,
    })
    yield Saga.put(
      TeamsGen.createRemoveParticipant({
        teamname,
        conversationIDKey,
        participant,
      })
    )
  } catch (error) {
    yield Saga.put(createGlobalError({globalError: convertToError(error)}))
  }
}

const _saveChannelMembership = function(action: TeamsGen.SaveChannelMembershipPayload, state: TypedState) {
  const {teamname, oldChannelState, newChannelState} = action.payload

  const calls = []
  for (const convIDKeyStr in newChannelState) {
    const convIDKey = ChatTypes.stringToConversationIDKey(convIDKeyStr)
    if (oldChannelState[convIDKey] === newChannelState[convIDKey]) {
      continue
    }

    if (newChannelState[convIDKey]) {
      calls.push(Saga.call(_joinConversation, teamname, convIDKey, action.payload.you))
    } else {
      calls.push(Saga.call(_leaveConversation, teamname, convIDKey, action.payload.you))
    }
  }

  return Saga.all(calls)
}

const _afterSaveCalls = results => {
  const after = last(results)
  const [rpcs] = results

  // Display any errors from the rpcs
  const errs = rpcs
    .filter(r => r.type === 'err')
    .map(({payload}) => Saga.put(createGlobalError({globalError: convertToError(payload)})))
  return Saga.all([...errs, after])
}

function* _createChannel(action: TeamsGen.CreateChannelPayload) {
  const {channelname, description, teamname, rootPath, sourceSubPath, destSubPath} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  try {
    const result = yield Saga.call(RPCChatTypes.localNewConversationLocalRpcPromise, {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      tlfVisibility: RPCTypes.commonTLFVisibility.private,
      topicType: RPCChatTypes.commonTopicType.chat,
      topicName: channelname,
    })

    // No error if we get here.
    const newConversationIDKey = result ? ChatTypes.conversationIDToKey(result.conv.info.id) : null
    if (!newConversationIDKey) {
      logger.warn('No convoid from newConvoRPC')
      return null
    }

    // If we were given a description, set it
    if (description) {
      yield Saga.call(RPCChatTypes.localPostHeadlineNonblockRpcPromise, {
        conversationID: result.conv.info.id,
        tlfName: teamname,
        tlfPublic: false,
        headline: description,
        clientPrev: 0,
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      })
    }

    // Dismiss the create channel dialog.
    yield Saga.put(
      putActionIfOnPath(rootPath.concat(sourceSubPath), navigateTo(destSubPath, rootPath), rootPath)
    )

    // Select the new channel, and switch to the chat tab.
    yield Saga.put(
      Chat2Gen.createSelectConversation({conversationIDKey: newConversationIDKey, reason: 'teamChat'})
    )
    yield Saga.put(navigateTo([chatTab]))
  } catch (error) {
    yield Saga.put(TeamsGen.createSetChannelCreationError({error: error.desc}))
  }
}

const _setMemberPublicity = function*(action: TeamsGen.SetMemberPublicityPayload, state: TypedState) {
  const {teamname, showcase} = action.payload
  yield Saga.put(createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsSetTeamMemberShowcaseRpcPromise, {
      isShowcased: showcase,
      name: teamname,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put(createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname})))

    // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
    yield Saga.put(TeamsGen.createGetTeams())
  }
}

const _setPublicity = function(action: TeamsGen.SetPublicityPayload, state: TypedState) {
  const {teamname, settings} = action.payload
  const waitingKey = {key: Constants.settingsWaitingKey(teamname)}

  const teamSettings = state.teams.getIn(
    ['teamNameToSettings', teamname],
    Constants.makeTeamSettings({
      open: false,
      joinAs: RPCTypes.teamsTeamRole['reader'],
    })
  )

  const teamPublicitySettings = Constants.getTeamPublicitySettings(state, teamname)

  const ignoreAccessRequests = teamPublicitySettings.ignoreAccessRequests
  const openTeam = teamSettings.open
  const openTeamRole = Constants.teamRoleByEnum[teamSettings.joinAs]
  const publicityAnyMember = teamPublicitySettings.anyMemberShowcase
  const publicityMember = teamPublicitySettings.member
  const publicityTeam = teamPublicitySettings.team

  const calls = []
  if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
    calls.push(
      // $FlowIssue doens't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsTeamSetSettingsRpcPromise, {
        name: teamname,
        settings: {
          joinAs: RPCTypes.teamsTeamRole[settings.openTeamRole],
          open: settings.openTeam,
        },
      })
    )
  }
  if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
    calls.push(
      // $FlowIssue doesn't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsSetTarsDisabledRpcPromise, {
        disabled: settings.ignoreAccessRequests,
        name: teamname,
      })
    )
  }
  if (publicityAnyMember !== settings.publicityAnyMember) {
    calls.push(
      // $FlowIssue doesn't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
        anyMemberShowcase: settings.publicityAnyMember,
        name: teamname,
      })
    )
  }
  if (publicityMember !== settings.publicityMember) {
    calls.push(
      // $FlowIssue doesn't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsSetTeamMemberShowcaseRpcPromise, {
        isShowcased: settings.publicityMember,
        name: teamname,
      })
    )
  }
  if (publicityTeam !== settings.publicityTeam) {
    calls.push(
      // $FlowIssue doesn't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
        isShowcased: settings.publicityTeam,
        name: teamname,
      })
    )
  }
  return Saga.all([
    Saga.all(calls),
    Saga.put(createIncrementWaiting(waitingKey)),
    Saga.identity(
      Saga.all([
        // TODO delete this getDetails call when CORE-7125 is finished
        Saga.put(TeamsGen.createGetDetails({teamname})),
        Saga.put(createDecrementWaiting(waitingKey)),
      ])
    ),
  ])
}

function _setupTeamHandlers() {
  engine().setIncomingActionCreators(
    'keybase.1.NotifyTeam.teamChangedByName',
    (args: RPCTypes.NotifyTeamTeamChangedByNameRpcParam, _, __, getState) => {
      const state = getState()
      logger.info(`Got teamChanged for ${args.teamName} from service`)
      const selectedTeamNames = Constants.getSelectedTeamNames(state)
      if (selectedTeamNames.includes(args.teamName)) {
        // only reload if that team is selected
        return getLoadCalls(args.teamName)
      }
      return getLoadCalls()
    }
  )
  engine().setIncomingActionCreators(
    'keybase.1.NotifyTeam.teamDeleted',
    (args: RPCTypes.NotifyTeamTeamDeletedRpcParam, _, __, getState) => {
      const state = getState()
      const {teamID} = args
      const selectedTeamNames = Constants.getSelectedTeamNames(state)
      if (selectedTeamNames.includes(Constants.getTeamNameFromID(state, teamID))) {
        return [navigateTo([], [teamsTab]), ...getLoadCalls()]
      }
      return getLoadCalls()
    }
  )
  engine().setIncomingActionCreators(
    'keybase.1.NotifyTeam.teamExit',
    (args: RPCTypes.NotifyTeamTeamExitRpcParam, _, __, getState) => {
      const state = getState()
      const {teamID} = args
      const selectedTeamNames = Constants.getSelectedTeamNames(state)
      if (selectedTeamNames.includes(Constants.getTeamNameFromID(state, teamID))) {
        return [navigateTo([], [teamsTab]), ...getLoadCalls()]
      }
      return getLoadCalls()
    }
  )
}

function getLoadCalls(teamname?: string) {
  const actions = []
  if (_wasOnTeamsTab) {
    actions.push(TeamsGen.createGetTeams())
    if (teamname) {
      actions.push(TeamsGen.createGetDetails({teamname}))
    }
  }
  return actions
}

function _updateTopic(action: TeamsGen.UpdateTopicPayload, state: TypedState) {
  const {teamname, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    tlfName: teamname,
    tlfPublic: false,
    headline: newTopic,
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
  }

  return Saga.sequentially([
    Saga.call(RPCChatTypes.localPostHeadlineRpcPromise, param),
    Saga.put(TeamsGen.createSetUpdatedTopic({teamname, conversationIDKey, newTopic})),
  ])
}

function _addTeamWithChosenChannels(action: TeamsGen.AddTeamWithChosenChannelsPayload, state: TypedState) {
  const {teamname} = action.payload
  if (state.teams.teamsWithChosenChannels.has(teamname)) {
    return
  }
  const newTeamsWithChosenChannels = state.teams.teamsWithChosenChannels.add(teamname)
  // We'd actually like to do this in one message to avoid having the UI glitch
  // momentarily inbetween the dismiss (and therefore thinking no teams have
  // had channels selected) and the re-inject.  For now, we have a workaround
  // of ignoring empty updates from the clearing in the reducer.  (CORE-7663.)
  return Saga.sequentially([
    Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
      category: 'chosenChannelsForTeam',
    }),
    Saga.put(
      GregorGen.createInjectItem({
        body: JSON.stringify(newTeamsWithChosenChannels.toJSON()),
        category: 'chosenChannelsForTeam',
      })
    ),
  ])
}

function _updateChannelname(action: TeamsGen.UpdateChannelNamePayload, state: TypedState) {
  const {teamname, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    tlfName: teamname,
    tlfPublic: false,
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
  }

  return Saga.sequentially([
    Saga.call(RPCChatTypes.localPostMetadataRpcPromise, param),
    Saga.put(TeamsGen.createSetUpdatedChannelName({teamname, conversationIDKey, newChannelName})),
  ])
}

function _deleteChannelConfirmed(action: TeamsGen.DeleteChannelConfirmedPayload, state: TypedState) {
  const {teamname, conversationIDKey} = action.payload
  return Saga.sequentially([
    // channelName is only needed for confirmation, so since we handle
    // confirmation ourselves we don't need to plumb it through.
    Saga.call(RPCChatTypes.localDeleteConversationLocalRpcPromise, {
      convID: ChatTypes.keyToConversationID(conversationIDKey),
      channelName: '',
      confirmed: true,
    }),
    Saga.put(TeamsGen.createDeleteChannelInfo({teamname, conversationIDKey})),
  ])
}

function _badgeAppForTeams(action: TeamsGen.BadgeAppForTeamsPayload, state: TypedState) {
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    // Don't make any calls we don't have permission to.
    return
  }

  const actions = []
  const newTeams = I.Set(action.payload.newTeamNames || [])
  const newTeamRequests = I.List(action.payload.newTeamAccessRequests || [])

  const teamsWithResetUsers = I.List(action.payload.teamsWithResetUsers || [])
  const teamsWithResetUsersMap = teamsWithResetUsers.reduce((res, entry) => {
    if (!res[entry.teamname]) {
      res[entry.teamname] = I.Set()
    }
    res[entry.teamname] = res[entry.teamname].add(
      Constants.makeResetUser({
        username: entry.username,
        badgeIDKey: Constants.resetUserBadgeIDToKey(entry.id),
      })
    )
    return res
  }, {})

  if (_wasOnTeamsTab && (newTeams.size > 0 || newTeamRequests.size > 0)) {
    // Call getTeams if new teams come in.
    // Covers the case when we're staring at the teams page so
    // we don't miss a notification we clear when we tab away
    const existingNewTeams = state.teams.getIn(['newTeams'], I.Set())
    const existingNewTeamRequests = state.teams.getIn(['newTeamRequests'], I.List())
    if (!newTeams.equals(existingNewTeams) && newTeams.size > 0) {
      // We have been added to a new team & we need to refresh the list
      actions.push(Saga.put(TeamsGen.createGetTeams()))
    }

    // getDetails for teams that have new access requests
    // Covers case where we have a badge appear on the requests
    // tab with no rows showing up
    const newTeamRequestsSet = I.Set(newTeamRequests)
    const existingNewTeamRequestsSet = I.Set(existingNewTeamRequests)
    const toLoad = newTeamRequestsSet.subtract(existingNewTeamRequestsSet)
    const loadingCalls = toLoad.map(teamname => Saga.put(TeamsGen.createGetDetails({teamname})))
    actions.push(Saga.all(loadingCalls.toArray()))
  }

  // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
  actions.push(
    Saga.put(
      TeamsGen.createSetNewTeamInfo({
        newTeams,
        newTeamRequests,
        teamNameToResetUsers: I.Map(teamsWithResetUsersMap),
      })
    )
  )
  return Saga.sequentially(actions)
}

let _wasOnTeamsTab = false
const _onTabChange = (action: RouteTypes.SwitchTo) => {
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === teamsTab) {
    _wasOnTeamsTab = true
  } else if (_wasOnTeamsTab) {
    _wasOnTeamsTab = false
    // clear badges
    return Saga.all([
      Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
        category: 'team.newly_added_to_team',
      }),
      Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
        category: 'team.request_access',
      }),
    ])
  }
}

const teamsSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(TeamsGen.leaveTeam, _leaveTeam)
  yield Saga.safeTakeEveryPure(TeamsGen.createNewTeam, _createNewTeam)
  yield Saga.safeTakeEvery(TeamsGen.joinTeam, _joinTeam)
  yield Saga.safeTakeEvery(TeamsGen.getDetails, _getDetails)
  yield Saga.safeTakeEvery(TeamsGen.getTeamPublicity, _getTeamPublicity)
  yield Saga.safeTakeEvery(TeamsGen.getTeamOperations, _getTeamOperations)
  yield Saga.safeTakeEvery(TeamsGen.createNewTeamFromConversation, _createNewTeamFromConversation)
  yield Saga.safeTakeEveryPure(TeamsGen.getChannels, _getChannels, _afterGetChannels)
  yield Saga.safeTakeEvery(TeamsGen.getTeams, _getTeams)
  yield Saga.safeTakeEveryPure(TeamsGen.saveChannelMembership, _saveChannelMembership)
  yield Saga.safeTakeEvery(TeamsGen.createChannel, _createChannel)
  yield Saga.safeTakeEveryPure(TeamsGen.setupTeamHandlers, _setupTeamHandlers)
  yield Saga.safeTakeEvery(TeamsGen.addToTeam, _addToTeam)
  yield Saga.safeTakeEvery(TeamsGen.addPeopleToTeam, _addPeopleToTeam)
  yield Saga.safeTakeEvery(TeamsGen.inviteToTeamByEmail, _inviteByEmail)
  yield Saga.safeTakeEvery(TeamsGen.ignoreRequest, _ignoreRequest)
  yield Saga.safeTakeEvery(TeamsGen.editTeamDescription, _editDescription)
  yield Saga.safeTakeEvery(TeamsGen.editMembership, _editMembership)
  yield Saga.safeTakeEvery(TeamsGen.removeMemberOrPendingInvite, _removeMemberOrPendingInvite)
  yield Saga.safeTakeEvery(TeamsGen.setMemberPublicity, _setMemberPublicity)
  yield Saga.safeTakeEveryPure(TeamsGen.updateTopic, _updateTopic, last)
  yield Saga.safeTakeEveryPure(TeamsGen.updateChannelName, _updateChannelname, last)
  yield Saga.safeTakeEveryPure(TeamsGen.deleteChannelConfirmed, _deleteChannelConfirmed)
  yield Saga.safeTakeEveryPure(TeamsGen.badgeAppForTeams, _badgeAppForTeams)
  yield Saga.safeTakeEveryPure(RouteConstants.switchTo, _onTabChange, null, logError)
  yield Saga.safeTakeEvery(TeamsGen.inviteToTeamByPhone, _inviteToTeamByPhone)
  yield Saga.safeTakeEveryPure(TeamsGen.setPublicity, _setPublicity, _afterSaveCalls)
  yield Saga.safeTakeEveryPure(
    TeamsGen.checkRequestedAccess,
    _checkRequestedAccess,
    _checkRequestedAccessSuccess
  )
  yield Saga.safeTakeEvery(TeamsGen.getTeamRetentionPolicy, _getTeamRetentionPolicy)
  yield Saga.safeTakeEveryPure(TeamsGen.saveTeamRetentionPolicy, _saveTeamRetentionPolicy)
  yield Saga.safeTakeEveryPure(Chat2Gen.updateTeamRetentionPolicy, _updateTeamRetentionPolicy)
  yield Saga.safeTakeEveryPure(TeamsGen.addTeamWithChosenChannels, _addTeamWithChosenChannels)
}

export default teamsSaga

// @flow
import logger from '../logger'
import map from 'lodash/map'
import keyBy from 'lodash/keyBy'
import last from 'lodash/last'
import * as I from 'immutable'
import * as TeamsGen from './teams-gen'
import * as Constants from '../constants/teams'
import * as ChatConstants from '../constants/chat'
import * as ChatTypes from '../constants/types/chat'
import * as SearchConstants from '../constants/search'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as RouteTypes from '../constants/types/route-tree'
import * as RouteConstants from '../constants/route-tree'
import * as Chat2Gen from './chat2-gen'
import engine from '../engine'
import {replaceEntity} from './entities'
import {usernameSelector} from '../constants/selectors'
import {isMobile} from '../constants/platform'
import {putActionIfOnPath, navigateTo} from './route-tree'
import {chatTab, teamsTab} from '../constants/tabs'
import openSMS from '../util/sms'
import {createDecrementWaiting, createIncrementWaiting} from '../actions/waiting-gen'
import {createGlobalError} from '../actions/config-gen'
import {convertToError} from '../util/errors'

import type {TypedState} from '../constants/reducer'

const _createNewTeam = function*(action: TeamsGen.CreateNewTeamPayload) {
  const {teamname, rootPath, sourceSubPath, destSubPath} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: true}))
  try {
    yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
      name: teamname,
      sendChatNotification: true,
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
    Saga.put(TeamsGen.createSetTeamJoinSuccess({success: false, teamname: null})),
  ])
  try {
    const result = yield Saga.call(RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise, {
      tokenOrName: teamname,
    })

    // Success
    yield Saga.put(
      TeamsGen.createSetTeamJoinSuccess({
        success: true,
        teamname: result && result.wasTeamName ? teamname : null,
      })
    )
  } catch (error) {
    yield Saga.put(TeamsGen.createSetTeamJoinError({error: error.desc}))
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
  const {role, teamname, sendChatNotification} = action.payload
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  const state: TypedState = yield Saga.select()
  const ids = SearchConstants.getUserInputItemIds(state, {searchKey: 'addToTeamSearch'})
  for (const id of ids) {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      name: teamname,
      email: '',
      username: id,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
    })
  }
  yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
}

const _inviteByEmail = function*(action: TeamsGen.InviteToTeamByEmailPayload) {
  const {invitees, role, teamname} = action.payload
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  yield Saga.put(
    replaceEntity(['teams', 'teamNameToLoadingInvites'], I.Map([[teamname, I.Map([[invitees, true]])]]))
  )
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
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
    yield Saga.put(replaceEntity(['teams', 'teamNameToLoadingInvites', teamname], I.Map([[invitees, false]])))
  }
}

const _addToTeam = function*(action: TeamsGen.AddToTeamPayload) {
  const {teamname, email, username, role, sendChatNotification} = action.payload
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      name: teamname,
      email,
      username,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
  }
}

const _editDescription = function*(action: TeamsGen.EditTeamDescriptionPayload) {
  const {teamname, description} = action.payload
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    yield Saga.call(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
      description,
      name: teamname,
    })
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
  }
}

const _editMembership = function*(action: TeamsGen.EditMembershipPayload) {
  const {teamname, username, role} = action.payload
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamEditMemberRpcPromise, {
      name: teamname,
      username,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
    })
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
  }
}

const _removeMemberOrPendingInvite = function*(action: TeamsGen.RemoveMemberOrPendingInvitePayload) {
  const {teamname, username, email, inviteID} = action.payload

  yield Saga.put(
    replaceEntity(
      ['teams', 'teamNameToLoadingInvites'],
      I.Map([[teamname, I.Map([[username || email || inviteID, true]])]])
    )
  )

  // disallow call with any pair of username, email, and ID to avoid black-bar errors
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamRemoveMemberRpcPromise, {email, name: teamname, username, inviteID})
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
    yield Saga.put(
      replaceEntity(
        ['teams', 'teamNameToLoadingInvites'],
        I.Map([[teamname, I.Map([[username || email || inviteID, false]])]])
      )
    )
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
  const seitan = yield Saga.call(RPCTypes.teamsTeamCreateSeitanTokenRpcPromise, {
    name: teamname,
    role: (!!role && RPCTypes.teamsTeamRole[role]) || 0,
    label: {t: 1, sms: ({f: fullName || '', n: phoneNumber}: RPCTypes.SeitanIKeyLabelSms)},
  })

  /* Open SMS */
  const bodyText = generateSMSBody(teamname, seitan)
  openSMS([phoneNumber], bodyText).catch(err => logger.info('Error sending SMS', err))

  yield Saga.put(TeamsGen.createGetDetails({teamname}))
}

const _ignoreRequest = function*(action: TeamsGen.IgnoreRequestPayload) {
  const {teamname, username} = action.payload
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamIgnoreRequestRpcPromise, {
      name: teamname,
      username,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(TeamsGen.createGetDetails({teamname}))) // getDetails will unset loading
  }
}

function getPendingConvParticipants(state: TypedState, conversationIDKey: ChatTypes.ConversationIDKey) {
  if (!ChatConstants.isPendingConversationIDKey(conversationIDKey)) return null

  return state.chat.pendingConversations.get(conversationIDKey)
}

const _createNewTeamFromConversation = function*(
  action: TeamsGen.CreateNewTeamFromConversationPayload
): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, teamname} = action.payload
  const state: TypedState = yield Saga.select()
  const me = usernameSelector(state)
  const inbox = ChatConstants.getInbox(state, conversationIDKey)
  let participants

  if (inbox) {
    participants = inbox.get('participants')
  } else {
    participants = getPendingConvParticipants(state, conversationIDKey)
  }

  if (participants) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
    yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: true}))
    try {
      const createRes = yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
        name: teamname,
        sendChatNotification: true,
      })
      for (const username of participants.toArray()) {
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
      yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey: null}))
    } catch (error) {
      yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
    } finally {
      yield Saga.put(TeamsGen.createSetTeamCreationPending({pending: false}))
    }
  }
}

const _getDetails = function*(action: TeamsGen.GetDetailsPayload): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  const waitingKey = {key: `getDetails:${teamname}`}
  // TODO completely replace teamNameToLoading with createIncrementWaiting?
  yield Saga.put(createIncrementWaiting(waitingKey))
  yield Saga.put(TeamsGen.createGetTeamOperations({teamname}))
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
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

    const implicitAdminDetails: Array<RPCTypes.TeamMemberDetails> =
      (yield Saga.call(RPCTypes.teamsTeamImplicitAdminsRpcPromise, {
        teamName: teamname,
      })) || []
    const implicitAdminUsernames = I.Set(implicitAdminDetails.map(x => x.username))

    // Get requests to join
    const requests: RPCTypes.TeamJoinRequest[] = yield Saga.call(RPCTypes.teamsTeamListRequestsRpcPromise)
    requests.sort((a, b) => a.username.localeCompare(b.username))

    const requestMap = requests.reduce((reqMap, req) => {
      if (!reqMap[req.name]) {
        reqMap[req.name] = I.Set()
      }
      reqMap[req.name] = reqMap[req.name].add(Constants.makeRequestInfo({username: req.username}))
      return reqMap
    }, {})

    const infos = []
    let memberNames = I.Set()
    const types = ['admins', 'owners', 'readers', 'writers']
    const typeMap = {
      admins: 'admin',
      owners: 'owner',
      readers: 'reader',
      writers: 'writer',
    }
    types.forEach(type => {
      const members = details.members[type] || []
      members.forEach(({active, fullName, username}) => {
        infos.push(
          Constants.makeMemberInfo({
            active,
            fullName,
            type: typeMap[type],
            username,
          })
        )
        memberNames = memberNames.add(username)
      })
    })

    const invitesMap = map(details.annotatedActiveInvites, invite =>
      Constants.makeInviteInfo({
        email: invite.type.c === RPCTypes.teamsTeamInviteCategory.email ? invite.name : '',
        name: invite.type.c === RPCTypes.teamsTeamInviteCategory.seitan ? invite.name : '',
        role: Constants.teamRoleByEnum[invite.role],
        username:
          invite.type.c === RPCTypes.teamsTeamInviteCategory.sbs ? `${invite.name}@${invite.type.sbs}` : '',
        id: invite.id,
      })
    )

    // if we have no requests for this team, make sure we don't hold on to any old ones
    if (!requestMap[teamname]) {
      yield Saga.put(replaceEntity(['teams', 'teamNameToRequests'], I.Map([[teamname, I.Set()]])))
    }

    // Get publicity settings for this team.
    const publicity: RPCTypes.TeamAndMemberShowcase = yield Saga.call(
      RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise,
      {
        name: teamname,
      }
    )

    const publicityMap = {
      anyMemberShowcase: publicity.teamShowcase.anyMemberShowcase,
      description: publicity.teamShowcase.description,
      member: publicity.isMemberShowcased,
      team: publicity.teamShowcase.isShowcased,
    }

    yield Saga.all([
      Saga.put(replaceEntity(['teams', 'teamNameToMembers'], I.Map([[teamname, I.Set(infos)]]))),
      Saga.put(replaceEntity(['teams', 'teamNameToMemberUsernames'], I.Map([[teamname, memberNames]]))),
      Saga.put(
        replaceEntity(
          ['teams', 'teamNameToImplicitAdminUsernames'],
          I.Map([[teamname, implicitAdminUsernames]])
        )
      ),
      Saga.put(replaceEntity(['teams', 'teamNameToRequests'], I.Map(requestMap))),
      Saga.put(replaceEntity(['teams', 'teamNameToTeamSettings'], I.Map({[teamname]: details.settings}))),
      Saga.put(replaceEntity(['teams', 'teamNameToInvites'], I.Map([[teamname, I.Set(invitesMap)]]))),
      Saga.put(replaceEntity(['teams', 'teamNameToPublicitySettings'], I.Map({[teamname]: publicityMap}))),
    ])
  } finally {
    yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, false]])))
    yield Saga.put(createDecrementWaiting(waitingKey))
  }
}

const _getTeamOperations = function*(
  action: TeamsGen.GetTeamOperationsPayload
): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname

  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    const teamOperation = yield Saga.call(RPCTypes.teamsCanUserPerformRpcPromise, {
      name: teamname,
    })
    yield Saga.put(replaceEntity(['teams', 'teamNameToCanPerform'], I.Map({[teamname]: teamOperation})))
  } finally {
    yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, false]])))
  }
}

function _getChannels(action: TeamsGen.GetChannelsPayload) {
  const teamname = action.payload.teamname
  const waitingKey = {key: `getChannels:${teamname}`}
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

function _afterGetChannels([results, teamname, waitingKey]: [
  RPCChatTypes.GetTLFConversationsLocalRes,
  string,
  {|key: string|},
]) {
  const convIDs = []
  const convIDToChannelInfo = {}

  const convs = results.convs || []
  convs.forEach(conv => {
    convIDs.push(conv.convID)
    convIDToChannelInfo[conv.convID] = Constants.makeChannelInfo({
      channelname: conv.channel,
      description: conv.headline,
      participants: I.Set(conv.participants || []),
    })
  })

  return Saga.all([
    Saga.put(replaceEntity(['teams', 'teamNameToConvIDs'], I.Map([[teamname, I.Set(convIDs)]]))),
    Saga.put(replaceEntity(['teams', 'convIDToChannelInfo'], I.Map(convIDToChannelInfo))),
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
  yield Saga.put(replaceEntity(['teams'], I.Map([['loaded', false]])))
  try {
    const results: RPCTypes.AnnotatedTeamList = yield Saga.call(RPCTypes.teamsTeamListRpcPromise, {
      all: false,
      includeImplicitTeams: false,
      userAssertion: username,
    })

    const teams = results.teams || []
    const teamnames = []
    const teammembercounts = {}
    const teamNameToRole = {}
    teams.forEach(team => {
      teamnames.push(team.fqName)
      teammembercounts[team.fqName] = team.memberCount
      teamNameToRole[team.fqName] = Constants.teamRoleByEnum[team.role]
    })

    yield Saga.put(
      replaceEntity(
        ['teams'],
        I.Map({
          teamnames: I.Set(teamnames),
          teammembercounts: I.Map(teammembercounts),
          teamNameToRole: I.Map(teamNameToRole),
        })
      )
    )
  } catch (err) {
    if (err.code === RPCTypes.constantsStatusCode.scapinetworkerror) {
      // Ignore API errors due to offline
    } else {
      throw err
    }
  } finally {
    yield Saga.put(replaceEntity(['teams'], I.Map([['loaded', true]])))
  }
}

const _checkRequestedAccess = (action: TeamsGen.CheckRequestedAccessPayload) =>
  Saga.call(RPCTypes.teamsTeamListMyAccessRequestsRpcPromise, {})

function _checkRequestedAccessSuccess(result) {
  const teams = (result || []).map(row => row.parts.join('.'))
  return Saga.put(replaceEntity(['teams'], I.Map([['teamAccessRequestsPending', I.Set(teams)]])))
}

const _saveChannelMembership = function(action: TeamsGen.SaveChannelMembershipPayload, state: TypedState) {
  const {teamname, channelState} = action.payload
  const convIDs: I.Set<string> = Constants.getConvIdsFromTeamName(state, teamname)
  const channelnameToConvID = keyBy(convIDs.toArray(), c => Constants.getChannelNameFromConvID(state, c))
  const waitingKey = {key: `saveChannel:${teamname}`}

  const calls = map(channelState, (wantsToBeInChannel: boolean, channelname: string) => {
    if (wantsToBeInChannel) {
      // $FlowIssue doens't like callAndWrap
      return Saga.callAndWrap(RPCChatTypes.localJoinConversationLocalRpcPromise, {
        tlfName: teamname,
        topicName: channelname,
        topicType: RPCChatTypes.commonTopicType.chat,
        visibility: RPCTypes.commonTLFVisibility.private,
      })
    }
    const convID =
      channelnameToConvID[channelname] && ChatConstants.keyToConversationID(channelnameToConvID[channelname])
    if (convID) {
      // $FlowIssue doens't like callAndWrap
      return Saga.callAndWrap(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
        convID,
      })
    }
  }).filter(Boolean)

  return Saga.all([
    Saga.all(calls),
    Saga.put(createIncrementWaiting(waitingKey)),
    Saga.identity(
      Saga.all([
        Saga.put(createDecrementWaiting(waitingKey)),
        Saga.put(TeamsGen.createGetChannels({teamname})),
      ])
    ),
  ])
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
    const newConversationIDKey = result ? ChatConstants.conversationIDToKey(result.conv.info.id) : null
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
    yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey: newConversationIDKey}))
    yield Saga.put(navigateTo([chatTab]))
  } catch (error) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
  }
}

const _setPublicity = function(action: TeamsGen.SetPublicityPayload, state: TypedState) {
  const {teamname, settings} = action.payload
  const waitingKey = {key: `setPublicity:${teamname}`}
  const teamSettings = state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {
    open: false,
    joinAs: RPCTypes.teamsTeamRole['reader'],
  })
  const teamPublicitySettings = state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname], {
    anyMemberShowcase: false,
    member: false,
    team: false,
  })
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
  if (publicityAnyMember !== settings.publicityAnyMember) {
    calls.push(
      // $FlowIssue doens't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
        anyMemberShowcase: settings.publicityAnyMember,
        name: teamname,
      })
    )
  }
  if (publicityMember !== settings.publicityMember) {
    calls.push(
      // $FlowIssue doens't like callAndWrap
      Saga.callAndWrap(RPCTypes.teamsSetTeamMemberShowcaseRpcPromise, {
        isShowcased: settings.publicityMember,
        name: teamname,
      })
    )
  }
  if (publicityTeam !== settings.publicityTeam) {
    calls.push(
      // $FlowIssue doens't like callAndWrap
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
        Saga.put(TeamsGen.createGetDetails({teamname})),
        Saga.put(createDecrementWaiting(waitingKey)),
      ])
    ),
  ])
}

function _setupTeamHandlers() {
  return Saga.put((dispatch: Dispatch) => {
    engine().setIncomingHandler(
      'keybase.1.NotifyTeam.teamChangedByName',
      (args: RPCTypes.NotifyTeamTeamChangedByNameRpcParam) => {
        if (!args.implicitTeam) {
          const actions = getLoadCalls(args.teamName)
          actions.forEach(dispatch)
        }
      }
    )
    engine().setIncomingHandler(
      'keybase.1.NotifyTeam.teamChangedByID',
      (args: RPCTypes.NotifyTeamTeamChangedByIDRpcParam) => {
        // ignore
      }
    )
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamDeleted', () => {
      const actions = getLoadCalls()
      actions.forEach(dispatch)
    })
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamExit', () => {
      const actions = getLoadCalls()
      actions.forEach(dispatch)
    })
  })
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
  const {conversationIDKey, newTopic} = action.payload
  const teamname = Constants.getTeamNameFromConvID(state, conversationIDKey) || ''
  const waitingKey = {key: `updateTopic:${conversationIDKey}`}
  const param = {
    conversationID: ChatConstants.keyToConversationID(conversationIDKey),
    tlfName: teamname,
    tlfPublic: false,
    headline: newTopic,
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
  }

  return Saga.all([
    Saga.put(createIncrementWaiting(waitingKey)),
    Saga.call(RPCChatTypes.localPostHeadlineRpcPromise, param),
    Saga.identity(
      Saga.all([
        Saga.put(createDecrementWaiting(waitingKey)),
        Saga.put(TeamsGen.createGetChannels({teamname})),
      ])
    ),
  ])
}

function _updateChannelname(action: TeamsGen.UpdateChannelNamePayload, state: TypedState) {
  const {conversationIDKey, newChannelName} = action.payload
  const teamname = Constants.getTeamNameFromConvID(state, conversationIDKey) || ''
  const waitingKey = {key: `updateChannelName:${conversationIDKey}`}
  const param = {
    channelName: newChannelName,
    conversationID: ChatConstants.keyToConversationID(conversationIDKey),
    tlfName: teamname,
    tlfPublic: false,
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
  }

  return Saga.all([
    Saga.put(createIncrementWaiting(waitingKey)),
    Saga.call(RPCChatTypes.localPostMetadataRpcPromise, param),
    Saga.identity(
      Saga.all([
        Saga.put(createDecrementWaiting(waitingKey)),
        Saga.put(TeamsGen.createGetChannels({teamname})),
      ])
    ),
  ])
}

function _deleteChannelConfirmed(action: TeamsGen.DeleteChannelConfirmedPayload, state: TypedState) {
  const {conversationIDKey} = action.payload
  const channelName = Constants.getChannelNameFromConvID(state, conversationIDKey)
  const teamname = Constants.getTeamNameFromConvID(state, conversationIDKey) || ''

  if (!channelName) {
    return
  }
  const param = {
    convID: ChatConstants.keyToConversationID(conversationIDKey),
    channelName,
    confirmed: true,
  }

  return Saga.sequentially([
    Saga.call(RPCChatTypes.localDeleteConversationLocalRpcPromise, param),
    Saga.put(TeamsGen.createGetChannels({teamname})),
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

  if (_wasOnTeamsTab && (newTeams.size > 0 || newTeamRequests.size > 0)) {
    // Call getTeams if new teams come in.
    // Covers the case when we're staring at the teams page so
    // we don't miss a notification we clear when we tab away
    const existingNewTeams = state.entities.getIn(['teams', 'newTeams'], I.Set())
    const existingNewTeamRequests = state.entities.getIn(['teams', 'newTeamRequests'], I.List())
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
  actions.push(Saga.put(replaceEntity(['teams'], I.Map([['newTeams', newTeams]]))))
  actions.push(Saga.put(replaceEntity(['teams'], I.Map([['newTeamRequests', newTeamRequests]]))))
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
  yield Saga.safeTakeEvery(TeamsGen.getTeamOperations, _getTeamOperations)
  yield Saga.safeTakeEvery(TeamsGen.createNewTeamFromConversation, _createNewTeamFromConversation)
  yield Saga.safeTakeEveryPure(TeamsGen.getChannels, _getChannels, _afterGetChannels)
  yield Saga.safeTakeEvery(TeamsGen.getTeams, _getTeams)
  yield Saga.safeTakeEveryPure(TeamsGen.saveChannelMembership, _saveChannelMembership, _afterSaveCalls)
  yield Saga.safeTakeEvery(TeamsGen.createChannel, _createChannel)
  yield Saga.safeTakeEveryPure(TeamsGen.setupTeamHandlers, _setupTeamHandlers)
  yield Saga.safeTakeEvery(TeamsGen.addToTeam, _addToTeam)
  yield Saga.safeTakeEvery(TeamsGen.addPeopleToTeam, _addPeopleToTeam)
  yield Saga.safeTakeEvery(TeamsGen.inviteToTeamByEmail, _inviteByEmail)
  yield Saga.safeTakeEvery(TeamsGen.ignoreRequest, _ignoreRequest)
  yield Saga.safeTakeEvery(TeamsGen.editTeamDescription, _editDescription)
  yield Saga.safeTakeEvery(TeamsGen.editMembership, _editMembership)
  yield Saga.safeTakeEvery(TeamsGen.removeMemberOrPendingInvite, _removeMemberOrPendingInvite)
  yield Saga.safeTakeEveryPure(TeamsGen.updateTopic, _updateTopic, last)
  yield Saga.safeTakeEveryPure(TeamsGen.updateChannelName, _updateChannelname, last)
  yield Saga.safeTakeEveryPure(TeamsGen.deleteChannelConfirmed, _deleteChannelConfirmed)
  yield Saga.safeTakeEveryPure(TeamsGen.badgeAppForTeams, _badgeAppForTeams)
  yield Saga.safeTakeEveryPure(RouteConstants.switchTo, _onTabChange)
  yield Saga.safeTakeEvery(TeamsGen.inviteToTeamByPhone, _inviteToTeamByPhone)
  yield Saga.safeTakeEveryPure(TeamsGen.setPublicity, _setPublicity, _afterSaveCalls)
  yield Saga.safeTakeEveryPure(
    TeamsGen.checkRequestedAccess,
    _checkRequestedAccess,
    _checkRequestedAccessSuccess
  )
}

export default teamsSaga

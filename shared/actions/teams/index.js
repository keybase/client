// @flow
import map from 'lodash/map'
import keyBy from 'lodash/keyBy'
import last from 'lodash/last'
import * as I from 'immutable'
import * as Types from '../../constants/types/teams'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/chat'
import * as SearchConstants from '../../constants/search'
import * as RPCChatTypes from '../../constants/types/flow-types-chat'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import * as RouteTypes from '../../constants/types/route-tree'
import * as RouteConstants from '../../constants/route-tree'
import * as ChatGen from '../chat-gen'
import engine from '../../engine'
import {replaceEntity} from '../entities'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'
import {putActionIfOnPath, navigateTo} from '../route-tree'
import {chatTab, teamsTab} from '../../constants/tabs'
import openSMS from '../../util/sms'
import {createDecrementWaiting, createIncrementWaiting} from '../../actions/waiting-gen'
import {createGlobalError} from '../../actions/config-gen'
import {convertToError} from '../../util/errors'

import type {TypedState} from '../../constants/reducer'

const _createNewTeam = function*(action: Types.CreateNewTeam) {
  const {payload: {name, rootPath, sourceSubPath, destSubPath}} = action
  yield Saga.put(Creators.setTeamCreationError(''))
  yield Saga.put(Creators.setTeamCreationPending(true))
  try {
    yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
      name,
      sendChatNotification: true,
    })

    // Dismiss the create team dialog.
    yield Saga.put(
      putActionIfOnPath(rootPath.concat(sourceSubPath), navigateTo(destSubPath, rootPath), rootPath)
    )

    // No error if we get here.
    yield Saga.put(navigateTo([isMobile ? chatTab : teamsTab]))
  } catch (error) {
    yield Saga.put(Creators.setTeamCreationError(error.desc))
  } finally {
    yield Saga.put(Creators.setTeamCreationPending(false))
  }
}

const _joinTeam = function*(action: Types.JoinTeam) {
  const {payload: {teamname}} = action
  yield Saga.all([Saga.put(Creators.setTeamJoinError('')), Saga.put(Creators.setTeamJoinSuccess(false))])
  try {
    yield Saga.call(RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise, {
      tokenOrName: teamname,
    })

    // Success
    yield Saga.put(Creators.setTeamJoinSuccess(true))
  } catch (error) {
    yield Saga.put(Creators.setTeamJoinError(error.desc))
  }
}

const _leaveTeam = function(action: Types.LeaveTeam) {
  const {payload: {teamname}} = action
  return Saga.call(RPCTypes.teamsTeamLeaveRpcPromise, {
    name: teamname,
    permanent: false,
  })
}

const _addPeopleToTeam = function*(action: Types.AddPeopleToTeam) {
  const {payload: {role, teamname, sendChatNotification}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  const ids = yield Saga.select(SearchConstants.getUserInputItemIds, {searchKey: 'addToTeamSearch'})
  for (const id of ids) {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      name: teamname,
      email: '',
      username: id,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
    })
  }
  yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname))) // getDetails will unset loading
}

const _inviteByEmail = function*(action: Types.InviteToTeamByEmail) {
  const {payload: {invitees, role, teamname}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  yield Saga.put(
    replaceEntity(['teams', 'teamNameToLoadingInvites'], I.Map([[teamname, I.Map([[invitees, true]])]]))
  )
  try {
    yield Saga.call(RPCTypes.teamsTeamAddEmailsBulkRpcPromise, {
      name: teamname,
      emails: invitees,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname))) // getDetails will unset loading
    yield Saga.put(replaceEntity(['teams', 'teamNameToLoadingInvites', teamname], I.Map([[invitees, false]])))
  }
}

const _addToTeam = function*(action: Types.AddToTeam) {
  const {payload: {name, email, username, role, sendChatNotification}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      name,
      email,
      username,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _editDescription = function*(action: Types.EditDescription) {
  const {payload: {name, description}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
      description,
      name,
    })
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _editMembership = function*(action: Types.EditMembership) {
  const {payload: {name, username, role}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamEditMemberRpcPromise, {
      name,
      username,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
    })
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _removeMemberOrPendingInvite = function*(action: Types.RemoveMemberOrPendingInvite) {
  const {payload: {name, username, email, inviteID}} = action

  yield Saga.put(
    replaceEntity(
      ['teams', 'teamNameToLoadingInvites'],
      I.Map([[name, I.Map([[username || email || inviteID, true]])]])
    )
  )

  // disallow call with any pair of username, email, and ID to avoid black-bar errors
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    console.error(errMsg)
    throw new Error(errMsg)
  }

  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamRemoveMemberRpcPromise, {email, name, username, inviteID})
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
    yield Saga.put(
      replaceEntity(
        ['teams', 'teamNameToLoadingInvites'],
        I.Map([[name, I.Map([[username || email || inviteID, false]])]])
      )
    )
  }
}

const _inviteToTeamByPhone = function*(action: Types.InviteToTeamByPhone) {
  const {payload: {teamname, role, phoneNumber, fullName = ''}} = action
  const seitan = yield Saga.call(RPCTypes.teamsTeamCreateSeitanTokenRpcPromise, {
    name: teamname,
    role: (!!role && RPCTypes.teamsTeamRole[role]) || 0,
    label: {t: 1, sms: ({f: fullName || '', n: phoneNumber}: RPCTypes.SeitanIKeyLabelSms)},
  })

  /* Open SMS */
  // seitan is 16chars
  // message sans teamname is 129chars long. Absolute max teamname + descriptor can be is 31chars to fit within 160 sms limit
  // max length of a teamname is 16chars, + 5 - 8 chars for descriptor is a max of 24chars for teamDescription
  let teamDescription
  if (teamname.length <= 16) {
    teamDescription = `${teamname} team`
  } else {
    // then this must be a subteam, and won't safely fit into a text
    const subteams = teamname.split('.')
    teamDescription = `${subteams[subteams.length - 1]} subteam`
  }
  const bodyText = `Please join the ${teamDescription} on Keybase. Install and paste this in the "Teams" tab:\n\ntoken: ${seitan.toUpperCase()}\n\nquick install: keybase.io/_/go`
  openSMS([phoneNumber], bodyText).catch(err => console.log('Error sending SMS', err))

  yield Saga.put(Creators.getDetails(teamname))
}

const _ignoreRequest = function*(action: Types.IgnoreRequest) {
  const {payload: {name, username}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamIgnoreRequestRpcPromise, {
      name,
      username,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

function getPendingConvParticipants(state: TypedState, conversationIDKey: ChatTypes.ConversationIDKey) {
  if (!ChatConstants.isPendingConversationIDKey(conversationIDKey)) return null

  return state.chat.pendingConversations.get(conversationIDKey)
}

const _createNewTeamFromConversation = function*(
  action: Types.CreateNewTeamFromConversation
): Saga.SagaGenerator<any, any> {
  const {payload: {conversationIDKey, name}} = action
  const me = yield Saga.select(usernameSelector)
  const inbox = yield Saga.select(ChatConstants.getInbox, conversationIDKey)
  let participants

  if (inbox) {
    participants = inbox.get('participants')
  } else {
    participants = yield Saga.select(getPendingConvParticipants, conversationIDKey)
  }

  if (participants) {
    yield Saga.put(Creators.setTeamCreationError(''))
    yield Saga.put(Creators.setTeamCreationPending(true))
    try {
      const createRes = yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
        name,
        sendChatNotification: true,
      })
      for (const username of participants.toArray()) {
        if (!createRes.creatorAdded || username !== me) {
          yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
            email: '',
            name,
            role: username === me ? RPCTypes.teamsTeamRole.admin : RPCTypes.teamsTeamRole.writer,
            sendChatNotification: true,
            username,
          })
        }
      }
      yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: null}))
    } catch (error) {
      yield Saga.put(Creators.setTeamCreationError(error.desc))
    } finally {
      yield Saga.put(Creators.setTeamCreationPending(false))
    }
  }
}

const _getDetails = function*(action: Types.GetDetails): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  const waitingKey = {key: `getDetails:${teamname}`}
  // TODO completely replace teamNameToLoading with createIncrementWaiting?
  yield Saga.put(createIncrementWaiting(waitingKey))
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    const details: RPCTypes.TeamDetails = yield Saga.call(RPCTypes.teamsTeamGetRpcPromise, {
      name: teamname,
      forceRepoll: false,
    })

    const implicitAdminDetails: Array<
      RPCTypes.TeamMemberDetails
    > = (yield Saga.call(RPCTypes.teamsTeamImplicitAdminsRpcPromise, {
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
      members.forEach(({username}) => {
        infos.push(
          Constants.makeMemberInfo({
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
        username: invite.type.c === RPCTypes.teamsTeamInviteCategory.sbs
          ? `${invite.name}@${invite.type.sbs}`
          : '',
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

const _changeOpenTeamSetting = function*({
  payload: {teamname, convertToOpen, defaultRole},
}: Types.MakeTeamOpen) {
  const param: RPCTypes.TeamsTeamSetSettingsRpcParam = {
    name: teamname,
    settings: {
      joinAs: RPCTypes.teamsTeamRole[defaultRole],
      open: convertToOpen,
    },
  }

  yield Saga.call(RPCTypes.teamsTeamSetSettingsRpcPromise, param)
  yield Saga.put(Creators.getDetails(teamname))
}

function _getChannels(action: Types.GetChannels) {
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

function _afterGetChannels(
  [results, teamname, waitingKey]: [RPCChatTypes.GetTLFConversationsLocalRes, string, {|key: string|}]
) {
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

const _getTeams = function*(action: Types.GetTeams): Saga.SagaGenerator<any, any> {
  const username = yield Saga.select(usernameSelector)
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
    teams.forEach(team => {
      teamnames.push(team.fqName)
      teammembercounts[team.fqName] = team.memberCount
    })

    yield Saga.put(
      replaceEntity(
        ['teams'],
        I.Map({teamnames: I.Set(teamnames), teammembercounts: I.Map(teammembercounts)})
      )
    )
  } finally {
    yield Saga.put(replaceEntity(['teams'], I.Map([['loaded', true]])))
  }
}

const _toggleChannelMembership = function*(
  action: Types.ToggleChannelMembership
): Saga.SagaGenerator<any, any> {
  const {teamname, channelname} = action.payload
  const {conversationIDKey, participants, you} = yield Saga.select((state: TypedState) => {
    // TODO this is broken. channelnames are not unique
    const conversationIDKey = Constants.getConversationIDKeyFromChannelName(state, channelname)
    return {
      conversationIDKey,
      participants: conversationIDKey ? Constants.getParticipants(state, conversationIDKey) : I.Set(),
      you: usernameSelector(state),
    }
  })

  if (participants.get(you)) {
    yield Saga.call(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
      convID: ChatConstants.keyToConversationID(conversationIDKey),
    })
  } else {
    yield Saga.call(RPCChatTypes.localJoinConversationByIDLocalRpcPromise, {
      convID: ChatConstants.keyToConversationID(conversationIDKey),
    })
  }

  // reload
  yield Saga.put(Creators.getChannels(teamname))
}

const _saveChannelMembership = function(
  {payload: {teamname, channelState}}: Types.SaveChannelMembership,
  state: TypedState
) {
  const convIDs: I.Set<string> = Constants.getConvIdsFromTeamName(state, teamname)
  const channelnameToConvID = keyBy(convIDs.toArray(), c => Constants.getChannelNameFromConvID(state, c))
  const waitingKey = {key: `saveChannel:${teamname}`}

  const calls = map(channelState, (wantsToBeInChannel: boolean, channelname: string) => {
    if (wantsToBeInChannel) {
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
      return Saga.callAndWrap(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
        convID,
      })
    }
  }).filter(Boolean)

  return Saga.all([
    Saga.all(calls),
    Saga.put(createIncrementWaiting(waitingKey)),
    Saga.identity(
      Saga.all([Saga.put(createDecrementWaiting(waitingKey)), Saga.put(Creators.getChannels(teamname))])
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

function* _createChannel(action: Types.CreateChannel) {
  const {payload: {channelname, description, teamname, rootPath, sourceSubPath, destSubPath}} = action
  yield Saga.put(Creators.setChannelCreationError(''))
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
      console.warn('No convoid from newConvoRPC')
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
    yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: newConversationIDKey}))
    yield Saga.put(navigateTo([chatTab]))
  } catch (error) {
    yield Saga.put(Creators.setChannelCreationError(error.desc))
  }
}

const _setPublicity = function({payload: {teamname, settings}}: Types.SetPublicity, state: TypedState) {
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
  const openTeamRole = teamSettings.joinAs
  const publicityAnyMember = teamPublicitySettings.anyMemberShowcase
  const publicityMember = teamPublicitySettings.member
  const publicityTeam = teamPublicitySettings.team

  const calls = []
  if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
    calls.push(
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
      Saga.callAndWrap(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
        anyMemberShowcase: settings.publicityAnyMember,
        name: teamname,
      })
    )
  }
  if (publicityMember !== settings.publicityMember) {
    calls.push(
      Saga.callAndWrap(RPCTypes.teamsSetTeamMemberShowcaseRpcPromise, {
        isShowcased: settings.publicityMember,
        name: teamname,
      })
    )
  }
  if (publicityTeam !== settings.publicityTeam) {
    calls.push(
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
      Saga.all([Saga.put(Creators.getDetails(teamname)), Saga.put(createDecrementWaiting(waitingKey))])
    ),
  ])
}

function* _setupTeamHandlers(): Saga.SagaGenerator<any, any> {
  yield Saga.put((dispatch: Dispatch) => {
    engine().setIncomingHandler(
      'keybase.1.NotifyTeam.teamChanged',
      (args: RPCTypes.NotifyTeamTeamChangedRpcParam) => {
        dispatch(Creators.getDetails(args.teamName))
        dispatch(Creators.getTeams())
      }
    )
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamDeleted', () => {
      dispatch(Creators.getTeams())
    })
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamExit', () => {
      dispatch(Creators.getTeams())
    })
  })
}

function _updateTopic({payload: {conversationIDKey, newTopic}}: Types.UpdateTopic, state: TypedState) {
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
      Saga.all([Saga.put(createDecrementWaiting(waitingKey)), Saga.put(Creators.getChannels(teamname))])
    ),
  ])
}

function _updateChannelname(
  {payload: {conversationIDKey, newChannelName}}: Types.UpdateChannelName,
  state: TypedState
) {
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
      Saga.all([Saga.put(createDecrementWaiting(waitingKey)), Saga.put(Creators.getChannels(teamname))])
    ),
  ])
}

function* _deleteChannel({payload: {conversationIDKey}}): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const channelName = Constants.getChannelNameFromConvID(state, conversationIDKey)
  const teamname = Constants.getTeamNameFromConvID(state, conversationIDKey) || ''

  if (!channelName) {
    return
  }
  const param = {
    convID: ChatConstants.keyToConversationID(conversationIDKey),
    channelName,
    confirmed: false,
  }

  yield Saga.call(RPCChatTypes.localDeleteConversationLocalRpcPromise, param)
  yield Saga.put(Creators.getChannels(teamname))
}

function* _badgeAppForTeams(action: Types.BadgeAppForTeams) {
  const username = yield Saga.select((state: TypedState) => state.config.username)
  if (!username) {
    // Don't make any calls we don't have permission to.
    return
  }
  const newTeams = I.Set(action.payload.newTeamNames || [])
  const newTeamRequests = I.List(action.payload.newTeamAccessRequests || [])
  // Call getTeams if new teams come in.
  // Covers the case when we're staring at the teams page so
  // we don't miss a notification we clear when we tab away
  const existingNewTeams = yield Saga.select((state: TypedState) =>
    state.entities.getIn(['teams', 'newTeams'], I.Set())
  )
  const existingNewTeamRequests = yield Saga.select((state: TypedState) =>
    state.entities.getIn(['teams', 'newTeamRequests'], I.List())
  )
  if (!newTeams.equals(existingNewTeams) || !newTeams.equals(existingNewTeamRequests)) {
    yield Saga.put(Creators.getTeams())
  }

  // getDetails for teams that have new access requests
  // Covers case where we have a badge appear on the requests
  // tab with no rows showing up
  const newTeamRequestsSet = I.Set(newTeamRequests)
  const existingNewTeamRequestsSet = I.Set(existingNewTeamRequests)
  const toLoad = newTeamRequestsSet.subtract(existingNewTeamRequestsSet)
  const loadingCalls = toLoad.map(teamname => Saga.put(Creators.getDetails(teamname)))
  yield Saga.all(loadingCalls.toArray())

  yield Saga.put(replaceEntity(['teams'], I.Map([['newTeams', newTeams]])))
  yield Saga.put(replaceEntity(['teams'], I.Map([['newTeamRequests', newTeamRequests]])))
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
  yield Saga.safeTakeEveryPure('teams:leaveTeam', _leaveTeam)
  yield Saga.safeTakeEveryPure('teams:createNewTeam', _createNewTeam)
  yield Saga.safeTakeEvery('teams:makeTeamOpen', _changeOpenTeamSetting)
  yield Saga.safeTakeEvery('teams:joinTeam', _joinTeam)
  yield Saga.safeTakeEvery('teams:getDetails', _getDetails)
  yield Saga.safeTakeEvery('teams:createNewTeamFromConversation', _createNewTeamFromConversation)
  yield Saga.safeTakeEveryPure('teams:getChannels', _getChannels, _afterGetChannels)
  yield Saga.safeTakeEvery('teams:getTeams', _getTeams)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
  yield Saga.safeTakeEveryPure('teams:saveChannelMembership', _saveChannelMembership, _afterSaveCalls)
  yield Saga.safeTakeEvery('teams:createChannel', _createChannel)
  yield Saga.safeTakeEvery('teams:setupTeamHandlers', _setupTeamHandlers)
  yield Saga.safeTakeEvery('teams:addToTeam', _addToTeam)
  yield Saga.safeTakeEvery('teams:addPeopleToTeam', _addPeopleToTeam)
  yield Saga.safeTakeEvery('teams:inviteToTeamByEmail', _inviteByEmail)
  yield Saga.safeTakeEvery('teams:ignoreRequest', _ignoreRequest)
  yield Saga.safeTakeEvery('teams:editDescription', _editDescription)
  yield Saga.safeTakeEvery('teams:editMembership', _editMembership)
  yield Saga.safeTakeEvery('teams:removeMemberOrPendingInvite', _removeMemberOrPendingInvite)
  yield Saga.safeTakeEveryPure('teams:updateTopic', _updateTopic, last)
  yield Saga.safeTakeEveryPure('teams:updateChannelName', _updateChannelname, last)
  yield Saga.safeTakeEvery('teams:deleteChannel', _deleteChannel)
  yield Saga.safeTakeEvery('teams:badgeAppForTeams', _badgeAppForTeams)
  yield Saga.safeTakeEveryPure(RouteConstants.switchTo, _onTabChange)
  yield Saga.safeTakeEvery('teams:inviteToTeamByPhone', _inviteToTeamByPhone)
  yield Saga.safeTakeEveryPure('teams:setPublicity', _setPublicity, _afterSaveCalls)
}

export default teamsSaga

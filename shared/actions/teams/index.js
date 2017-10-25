// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as SearchConstants from '../../constants/search'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as RpcTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import * as ChatCreators from '../chat/creators'
import engine from '../../engine'
import map from 'lodash/map'
import {replaceEntity} from '../entities'
import {call, put, select, all} from 'redux-saga/effects'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'
import {navigateTo} from '../route-tree'
import {chatTab, teamsTab} from '../../constants/tabs'

import type {AnnotatedTeamList} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

const _createNewTeam = function*(action: Constants.CreateNewTeam) {
  const {payload: {name}} = action
  yield put(Creators.setTeamCreationError(''))
  try {
    yield call(RpcTypes.teamsTeamCreateRpcPromise, {
      param: {name, sendChatNotification: true},
    })

    // No error if we get here.
    yield put(navigateTo([isMobile ? chatTab : teamsTab]))
  } catch (error) {
    yield put(Creators.setTeamCreationError(error.desc))
  }
}

const _joinTeam = function*(action: Constants.JoinTeam) {
  const {payload: {teamname}} = action
  yield all(put(Creators.setTeamJoinError('')), put(Creators.setTeamJoinSuccess(false)))
  try {
    yield call(RpcTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise, {
      param: {tokenOrName: teamname},
    })

    // Success
    yield put(Creators.setTeamJoinSuccess(true))
  } catch (error) {
    yield put(Creators.setTeamJoinError(error.desc))
  }
}

const _leaveTeam = function(action: Constants.LeaveTeam) {
  const {payload: {teamname}} = action
  return call(RpcTypes.teamsTeamLeaveRpcPromise, {
    param: {name: teamname},
  })
}

const _addPeopleToTeam = function*(action: Constants.AddPeopleToTeam) {
  const {payload: {role, teamname}} = action
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  const ids = yield select(SearchConstants.getUserInputItemIds, {searchKey: 'addToTeamSearch'})
  for (const id of ids) {
    yield call(RpcTypes.teamsTeamAddMemberRpcPromise, {
      param: {
        name: teamname,
        email: '',
        username: id,
        role: role && RpcTypes.TeamsTeamRole[role],
        sendChatNotification: true,
      },
    })
  }
  yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname))) // getDetails will unset loading
}

const _inviteByEmail = function*(action: Constants.InviteToTeamByEmail) {
  const {payload: {invitees, role, teamname}} = action
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    yield call(RpcTypes.teamsTeamAddEmailsBulkRpcPromise, {
      param: {
        name: teamname,
        emails: invitees,
        role: role && RpcTypes.TeamsTeamRole[role],
      },
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname))) // getDetails will unset loading
  }
}

const _addToTeam = function*(action: Constants.AddToTeam) {
  const {payload: {name, email, username, role, sendChatNotification}} = action
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield call(RpcTypes.teamsTeamAddMemberRpcPromise, {
      param: {
        name,
        email,
        username,
        role: role && RpcTypes.TeamsTeamRole[role],
        sendChatNotification,
      },
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _editMembership = function*(action: Constants.EditMembership) {
  const {payload: {name, username, role}} = action
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield call(RpcTypes.teamsTeamEditMemberRpcPromise, {
      param: {name, username, role: RpcTypes.TeamsTeamRole[role]},
    })
  } finally {
    yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _removeMemberOrPendingInvite = function*(action: Constants.RemoveMemberOrPendingInvite) {
  const {payload: {name, username, email}} = action

  // disallow call with both username & email
  if (!!username && !!email) {
    const errMsg = 'Supplied both email and username to removeMemberOrPendingInvite'
    console.error(errMsg)
    throw new Error(errMsg)
  }

  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield call(RpcTypes.teamsTeamRemoveMemberRpcPromise, {param: {email, name, username}})
  } finally {
    yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _ignoreRequest = function*(action: Constants.IgnoreRequest) {
  const {payload: {name, username}} = action
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield call(RpcTypes.teamsTeamIgnoreRequestRpcPromise, {
      param: {
        name,
        username,
      },
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

function getPendingConvParticipants(state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) {
  if (!ChatConstants.isPendingConversationIDKey(conversationIDKey)) return null

  return state.chat.pendingConversations.get(conversationIDKey)
}

const _createNewTeamFromConversation = function*(
  action: Constants.CreateNewTeamFromConversation
): SagaGenerator<any, any> {
  const {payload: {conversationIDKey, name}} = action
  const me = yield select(usernameSelector)
  const inbox = yield select(ChatConstants.getInbox, conversationIDKey)
  let participants

  if (inbox) {
    participants = inbox.get('participants')
  } else {
    participants = yield select(getPendingConvParticipants, conversationIDKey)
  }

  if (participants) {
    const createRes = yield call(RpcTypes.teamsTeamCreateRpcPromise, {
      param: {name, sendChatNotification: true},
    })
    for (const username of participants.toArray()) {
      if (!createRes.creatorAdded || username !== me) {
        yield call(RpcTypes.teamsTeamAddMemberRpcPromise, {
          param: {
            email: '',
            name,
            role: username === me ? RpcTypes.TeamsTeamRole.admin : RpcTypes.TeamsTeamRole.writer,
            sendChatNotification: true,
            username,
          },
        })
      }
    }
  }
}

const _getDetails = function*(action: Constants.GetDetails): SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    const results: RpcTypes.TeamDetails = yield call(RpcTypes.teamsTeamGetRpcPromise, {
      param: {
        name: teamname,
      },
    })

    // Get requests to join
    const requests: RpcTypes.TeamJoinRequest[] = yield call(RpcTypes.teamsTeamListRequestsRpcPromise)
    requests.sort((a, b) => a.username.localeCompare(b.username))

    const requestMap = requests.reduce((reqMap, req) => {
      if (!reqMap[req.name]) {
        reqMap[req.name] = I.List()
      }
      reqMap[req.name] = reqMap[req.name].push({username: req.username})
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
      const details = results.members[type] || []
      details.forEach(({username}) => {
        infos.push(
          Constants.makeMemberInfo({
            type: typeMap[type],
            username,
          })
        )
        memberNames = memberNames.add(username)
      })
    })

    const invitesMap = map(results.annotatedActiveInvites, invite =>
      Constants.makeInviteInfo({
        email: invite.type.c === RpcTypes.TeamsTeamInviteCategory.email ? invite.name : '',
        role: Constants.teamRoleByEnum[invite.role],
        username: invite.type.c === RpcTypes.TeamsTeamInviteCategory.sbs
          ? `${invite.name}@${invite.type.sbs}`
          : '',
      })
    )

    // if we have no requests for this team, make sure we don't hold on to any old ones
    if (!requestMap[teamname]) {
      yield put(replaceEntity(['teams', 'teamNameToRequests'], I.Map([[teamname, I.Set()]])))
    }

    yield all([
      put(replaceEntity(['teams', 'teamNameToMembers'], I.Map([[teamname, I.Set(infos)]]))),
      put(replaceEntity(['teams', 'teamNameToMemberUsernames'], I.Map([[teamname, memberNames]]))),
      put(replaceEntity(['teams', 'teamNameToRequests'], I.Map(requestMap))),
      put(replaceEntity(['teams', 'teamNameToTeamSettings'], I.Map({[teamname]: results.settings}))),
      put(replaceEntity(['teams', 'teamNameToInvites'], I.Map([[teamname, I.Set(invitesMap)]]))),
    ])
  } finally {
    yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, false]])))
  }
}

const _changeOpenTeamSetting = function*({
  payload: {teamname, convertToOpen, defaultRole},
}: Constants.MakeTeamOpen) {
  const param: RpcTypes.teamsTeamSetSettingsRpcParam = {
    name: teamname,
    settings: {
      joinAs: RpcTypes.TeamsTeamRole[defaultRole],
      open: convertToOpen,
    },
  }

  yield call(RpcTypes.teamsTeamSetSettingsRpcPromise, {param})
  yield put(Creators.getDetails(teamname))
}

const _getChannels = function*(action: Constants.GetChannels): SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  const results: ChatTypes.GetTLFConversationsLocalRes = yield call(
    ChatTypes.localGetTLFConversationsLocalRpcPromise,
    {
      param: {
        membersType: ChatTypes.CommonConversationMembersType.team,
        tlfName: teamname,
        topicType: ChatTypes.CommonTopicType.chat,
      },
    }
  )

  const convIDs = []
  const convIDToChannelInfo = {}

  const convs = results.convs || []
  convs.forEach(conv => {
    const convID = ChatConstants.conversationIDToKey(conv.convID)
    convIDs.push(convID)
    convIDToChannelInfo[convID] = Constants.makeChannelInfo({
      channelname: conv.channel,
      description: conv.headline,
      participants: I.Set(conv.participants || []),
    })
  })

  yield all([
    put(replaceEntity(['teams', 'teamNameToConvIDs'], I.Map([[teamname, I.Set(convIDs)]]))),
    put(replaceEntity(['teams', 'convIDToChannelInfo'], I.Map(convIDToChannelInfo))),
  ])
}

const _getTeams = function*(action: Constants.GetTeams): SagaGenerator<any, any> {
  const username = yield select(usernameSelector)
  yield put(replaceEntity(['teams'], I.Map([['loaded', false]])))
  try {
    const results: AnnotatedTeamList = yield call(RpcTypes.teamsTeamListRpcPromise, {
      param: {
        userAssertion: username,
      },
    })

    const teams = results.teams || []
    const teamnames = teams.map(team => team.fqName)
    yield put(replaceEntity(['teams'], I.Map({teamnames: I.Set(teamnames)})))
  } finally {
    yield put(replaceEntity(['teams'], I.Map([['loaded', true]])))
  }
}

const _toggleChannelMembership = function*(
  action: Constants.ToggleChannelMembership
): SagaGenerator<any, any> {
  const {teamname, channelname} = action.payload
  const {conversationIDKey, participants, you} = yield select((state: TypedState) => {
    const conversationIDKey = Constants.getConversationIDKeyFromChannelName(state, channelname)
    return {
      conversationIDKey,
      participants: conversationIDKey ? Constants.getParticipants(state, conversationIDKey) : I.Set(),
      you: usernameSelector(state),
    }
  })

  if (participants.get(you)) {
    yield call(ChatTypes.localLeaveConversationLocalRpcPromise, {
      param: {
        convID: ChatConstants.keyToConversationID(conversationIDKey),
      },
    })
  } else {
    yield call(ChatTypes.localJoinConversationLocalRpcPromise, {
      param: {
        tlfName: teamname,
        topicName: channelname,
        topicType: ChatTypes.CommonTopicType.chat,
        visibility: RpcTypes.CommonTLFVisibility.private,
      },
    })
  }

  // reload
  yield put(Creators.getChannels(teamname))
}

function* _createChannel(action: Constants.CreateChannel) {
  const {payload: {channelname, description, teamname}} = action
  const result = yield call(ChatTypes.localNewConversationLocalRpcPromise, {
    param: {
      identifyBehavior: RpcTypes.TlfKeysTLFIdentifyBehavior.chatGui,
      membersType: ChatTypes.CommonConversationMembersType.team,
      tlfName: teamname,
      tlfVisibility: RpcTypes.CommonTLFVisibility.private,
      topicType: ChatTypes.CommonTopicType.chat,
      topicName: channelname,
    },
  })

  const newConversationIDKey = result ? ChatConstants.conversationIDToKey(result.conv.info.id) : null
  if (!newConversationIDKey) {
    console.warn('No convoid from newConvoRPC')
    return null
  }

  // Select the new channel
  yield put(ChatCreators.selectConversation(newConversationIDKey, false))

  // If we were given a description, set it
  if (description) {
    yield call(ChatTypes.localPostHeadlineNonblockRpcPromise, {
      param: {
        conversationID: result.conv.info.id,
        tlfName: teamname,
        tlfPublic: false,
        headline: description,
        clientPrev: null,
        identifyBehavior: RpcTypes.TlfKeysTLFIdentifyBehavior.chatGui,
      },
    })
  }
}

function* _setupTeamHandlers(): SagaGenerator<any, any> {
  yield put((dispatch: Dispatch) => {
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamChanged', () => {
      dispatch(Creators.getTeams())
    })
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamDeleted', () => {
      dispatch(Creators.getTeams())
    })
  })
}

const teamsSaga = function*(): SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure('teams:leaveTeam', _leaveTeam)
  yield Saga.safeTakeEveryPure('teams:createNewTeam', _createNewTeam)
  yield Saga.safeTakeEvery('teams:makeTeamOpen', _changeOpenTeamSetting)
  yield Saga.safeTakeEvery('teams:joinTeam', _joinTeam)
  yield Saga.safeTakeEvery('teams:getDetails', _getDetails)
  yield Saga.safeTakeEvery('teams:createNewTeamFromConversation', _createNewTeamFromConversation)
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:getTeams', _getTeams)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
  yield Saga.safeTakeEvery('teams:createChannel', _createChannel)
  yield Saga.safeTakeEvery('teams:setupTeamHandlers', _setupTeamHandlers)
  yield Saga.safeTakeEvery('teams:addToTeam', _addToTeam)
  yield Saga.safeTakeEvery('teams:addPeopleToTeam', _addPeopleToTeam)
  yield Saga.safeTakeEvery('teams:inviteToTeamByEmail', _inviteByEmail)
  yield Saga.safeTakeEvery('teams:ignoreRequest', _ignoreRequest)
  yield Saga.safeTakeEvery('teams:editMembership', _editMembership)
  yield Saga.safeTakeEvery('teams:removeMemberOrPendingInvite', _removeMemberOrPendingInvite)
}

export default teamsSaga

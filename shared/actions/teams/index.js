// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as RpcTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import * as ChatCreators from '../chat/creators'
import engine from '../../engine'
import {selectedInboxSelector} from '../chat/shared'
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

const _leaveTeam = function(action: Constants.LeaveTeam) {
  const {payload: {teamname}} = action
  return call(RpcTypes.teamsTeamLeaveRpcPromise, {
    param: {name: teamname},
  })
}

function getPendingConvParticpants(state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) {
  if (!ChatConstants.isPendingConversationIDKey(conversationIDKey)) return null

  return state.chat.pendingConversations.get(conversationIDKey)
}

const _createNewTeamFromConversation = function*(
  action: Constants.CreateNewTeamFromConversation
): SagaGenerator<any, any> {
  const {payload: {conversationIDKey, name}} = action
  const me = yield select(usernameSelector)
  const inbox = yield select(selectedInboxSelector, conversationIDKey)
  var participants

  if (inbox) {
    participants = inbox.get('participants').toArray()
  } else {
    participants = yield select(getPendingConvParticpants, conversationIDKey)
  }

  if (participants) {
    const createRes = yield call(RpcTypes.teamsTeamCreateRpcPromise, {
      param: {name, sendChatNotification: true},
    })
    for (const username of participants) {
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

    const infos = []
    const types = ['admins', 'owners', 'readers', 'writers']
    types.forEach(type => {
      const details = results.members[type] || []
      details.forEach(({username}) => {
        infos.push(
          Constants.MemberInfo({
            type,
            username,
          })
        )
      })
    })

    yield put(replaceEntity(['teams', 'teamNameToMembers'], I.Map([[teamname, I.Set(infos)]])))
  } finally {
    yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, false]])))
  }
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
    convIDToChannelInfo[convID] = Constants.ChannelInfo({
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
    yield put(replaceEntity(['teams'], {teamnames: I.Set(teamnames)}))
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
  yield Saga.safeTakeEvery('teams:getDetails', _getDetails)
  yield Saga.safeTakeEvery('teams:createNewTeamFromConversation', _createNewTeamFromConversation)
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:getTeams', _getTeams)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
  yield Saga.safeTakeEvery('teams:createChannel', _createChannel)
  yield Saga.safeTakeEvery('teams:setupTeamHandlers', _setupTeamHandlers)
}

export default teamsSaga

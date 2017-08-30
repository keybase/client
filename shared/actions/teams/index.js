// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import {replaceEntity} from '../entities'
import {call, put, select, all} from 'redux-saga/effects'
import {usernameSelector} from '../../constants/selectors'

import type {SagaGenerator} from '../../constants/types/saga'

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
  const convIDToParticipants = {}
  const convIDToChannelName = {}
  const convIDToDescription = {}

  const convs = results.convs || []
  convs.forEach(conv => {
    const convID = ChatConstants.conversationIDToKey(conv.convID)
    convIDs.push(convID)
    convIDToParticipants[convID] = I.Set(conv.participants || [])
    convIDToChannelName[convID] = conv.channel
    convIDToDescription[convID] = conv.headline
  })

  yield all([
    put(replaceEntity(['teams', 'teamNameToConvIDs'], I.Map([[teamname, I.Set(convIDs)]]))),
    put(replaceEntity(['teams', 'convIDToParticipants'], I.Map(convIDToParticipants))),
    put(replaceEntity(['teams', 'convIDToChannelName'], I.Map(convIDToChannelName))),
    put(replaceEntity(['teams', 'convIDToDescription'], I.Map(convIDToDescription))),
  ])
}

const _toggleChannelMembership = function*(
  action: Constants.ToggleChannelMembership
): SagaGenerator<any, any> {
  const {teamname, channelname} = action.payload
  const state = yield select(state => state)
  const conversationIDKey = state.entities
    .getIn(['teams', 'convIDToChannelName'], I.Map())
    .findKey(v => v === channelname)
  const participants = state.entities.getIn(['teams', 'convIDToParticipants', conversationIDKey], I.Set())
  const you = usernameSelector(state)

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
        visibility: ChatTypes.CommonTLFVisibility.private,
      },
    })
  }

  // reload
  yield put(Creators.getChannels(teamname))
}

const teamsSaga = function*(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
}

export default teamsSaga

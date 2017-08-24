// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import {replaceEntity} from '../entities'
import {call, put, select} from 'redux-saga/effects'
import {usernameSelector} from '../../constants/selectors'

import type {SagaGenerator} from '../../constants/types/saga'

const _getChannels = function*(action: Constants.GetChannels): SagaGenerator<any, any> {
  const results = yield call(ChatTypes.localGetTLFConversationsLocalRpcPromise, {
    param: {
      includeAuxiliaryInfo: false,
      membersType: ChatTypes.CommonConversationMembersType.team,
      tlfName: action.payload.teamname,
      topicType: ChatTypes.CommonTopicType.chat,
    },
  })

  const entityMap = results.convs.reduce((map, conv) => {
    const name = conv.info.topicName
    map[name] = Constants.ChannelRecord({
      conversationIDKey: ChatConstants.conversationIDToKey(conv.info.id),
      participants: I.Set([].concat(conv.info.readerNames, conv.info.writerNames)),
    })
    return map
  }, {})

  yield put(replaceEntity(['teams', action.payload.teamname, 'channels'], entityMap))
}

const _toggleChannelMembership = function*(
  action: Constants.ToggleChannelMembership
): SagaGenerator<any, any> {
  const channel = yield select(state =>
    state.entities.getIn(['teams', action.payload.teamname, 'channels', action.payload.channelname], I.Map())
  )
  const participants = channel.get('participants')
  const conversationIDKey = channel.get('conversationIDKey')

  const you = yield select(usernameSelector)
  if (participants.get(you)) {
    yield call(ChatTypes.localLeaveConversationLocalRpcPromise, {
      param: {
        convID: ChatConstants.keyToConversationID(conversationIDKey),
      },
    })
  } else {
    yield call(ChatTypes.localJoinConversationLocalRpcPromise, {
      param: {
        tlfName: action.payload.teamname,
        topicName: action.payload.channelname,
        topicType: ChatTypes.CommonTopicType.chat,
        visibility: ChatTypes.CommonTLFVisibility.private,
      },
    })
  }

  // reload
  yield put(Creators.getChannels(action.payload.teamname))
}

const teamsSaga = function*(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
}

export default teamsSaga

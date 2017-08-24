// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Saga from '../../util/saga'
import {replaceEntity} from '../entities'
import {call, put} from 'redux-saga/effects'

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
      participants: I.Set([].concat(conv.info.readerNames, conv.info.writerNames)),
    })
    return map
  }, {})

  yield put(replaceEntity(['teams', action.payload.teamname, 'channels'], entityMap))
}

const _toggleChannelMembership = function*(
  action: Constants.ToggleChannelMembership
): SagaGenerator<any, any> {
  // const results = yield call(ChatTypes.localGetTLFConversationsLocalRpcPromise, {
}

const teamsSaga = function*(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
}

export default teamsSaga

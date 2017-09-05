// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import {selectedInboxSelector} from '../chat/shared'
import {replaceEntity} from '../entities'
import {call, put, select, all} from 'redux-saga/effects'
import {usernameSelector} from '../../constants/selectors'
import {
  CommonTLFVisibility,
  teamsTeamCreateRpcPromise,
  teamsTeamAddMemberRpcPromise,
  teamsTeamListRpcPromise,
  TeamsTeamRole,
} from '../../constants/types/flow-types'

import type {AnnotatedTeamList} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

const _createNewTeam = function*(action: Constants.CreateNewTeam): SagaGenerator<any, any> {
  const {payload: {name}} = action
  yield call(teamsTeamCreateRpcPromise, {
    param: {name: {parts: [name]}},
  })
}

const _createNewTeamFromConversation = function*(
  action: Constants.CreateNewTeamFromConversation
): SagaGenerator<any, any> {
  const {payload: {conversationIDKey, name}} = action
  const me = yield select(usernameSelector)
  const inbox = yield select(selectedInboxSelector, conversationIDKey)
  if (inbox) {
    yield call(teamsTeamCreateRpcPromise, {
      param: {name: {parts: [name]}},
    })
    const participants = inbox.get('participants').toArray()
    for (const username of participants) {
      if (username !== me) {
        yield call(teamsTeamAddMemberRpcPromise, {
          param: {
            email: '',
            name,
            role: TeamsTeamRole.writer,
            sendChatNotification: true,
            username,
          },
        })
      }
    }
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
  const results: AnnotatedTeamList = yield call(teamsTeamListRpcPromise, {
    param: {
      userAssertion: username,
    },
  })

  const teams = results.teams || []
  const teamnames = teams.map(team => team.fqName)
  yield all([put(replaceEntity(['teams', 'teamnames'], I.Set(teamnames)))])
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
        visibility: CommonTLFVisibility.private,
      },
    })
  }

  // reload
  yield put(Creators.getChannels(teamname))
}

const teamsSaga = function*(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('chat:createNewTeam', _createNewTeam)
  yield Saga.safeTakeEvery('chat:createNewTeamFromConversation', _createNewTeamFromConversation)
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:getTeams', _getTeams)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
}

export default teamsSaga

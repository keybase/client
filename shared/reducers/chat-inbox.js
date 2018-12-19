// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2/meta'
import * as I from 'immutable'
// import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
// import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'
// import HiddenString from '../util/hidden-string'
import * as Flow from '../util/flow'

const initialState = Constants.makeState()

type Actions =
  | Chat2Gen.MessageSendPayload
  | Chat2Gen.MetasReceivedPayload
  | Chat2Gen.SelectConversationPayload
  | Chat2Gen.SetInboxFilterPayload

export default (state: Types.InboxState = initialState, action: Actions): Types.InboxState => {
  switch (action.type) {
    case Chat2Gen.selectConversation:
      return action.payload.reason === 'inboxFilterArrow' || action.payload.reason === 'inboxFilterChanged'
        ? state
        : state.merge({filter: ''})
    case Chat2Gen.messageSend:
      return state.merge({filter: ''})
    case Chat2Gen.setInboxFilter:
      return state.merge({filter: action.payload.filter})
    case Chat2Gen.metasReceived: {
      // TODO incremental
      const smallTeams = action.payload.fromInboxRefresh
        ? I.List(action.payload.metas.filter(m => m.teamType !== 'big').map(m => m.conversationIDKey))
        : state.smallTeams
      return state.merge({
        hasLoaded: action.payload.fromInboxRefresh || state.hasLoaded,
        smallTeams,
      })
    }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

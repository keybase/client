// @flow
// import * as I from 'immutable'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as Types from '../constants/types/chat2'

const initialState: Types.State = Constants.makeState()

// For a single conversation
// function conversationReducer(c: Types.Conversation, action: Chat2Gen.Actions): Types.Conversation {
// switch (action.type) {
// case Chat2Gen.inboxRefresh:
// case Chat2Gen.inboxUtrustedLoaded:
// case Chat2Gen.resetStore:
// return state
// default:
// // eslint-disable-next-line no-unused-expressions
// (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
// return state
// }
// }

// Root reducer
export default function(state: Types.State = initialState, action: Chat2Gen.Actions): Types.State {
  switch (action.type) {
    case Chat2Gen.resetStore:
      return initialState
    case Chat2Gen.inboxUtrustedLoaded: {
      const {untrusted} = action.payload
      return state.idToConversation.withMutations(m => {
        untrusted.forEach(u => {
          :
        })
      })
    }
    // Saga only actions
    case Chat2Gen.inboxRefresh:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

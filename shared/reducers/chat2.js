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
const metaMapReducer = (metaMap, action) => {
  switch (action.type) {
    case Chat2Gen.metasReceived:
      return metaMap.withMutations(map => {
        action.payload.metas.forEach(meta => {
          const old = map.get(meta.id)
          // Only update if this is newer
          if (!old || meta.inboxVersion > old.inboxVersion) {
            map.set(meta.id, meta)
          }
        })
      })
    case Chat2Gen.metaUpdateTrustedState:
      return metaMap.withMutations(m => {
        action.payload.conversationIDKeys.forEach(id => {
          m.setIn([id, 'trustedState'], action.payload.newState)
        })
      })
    default:
      return metaMap
  }
}

const rootReducer = (state: Types.State = initialState, action: Chat2Gen.Actions): Types.State => {
  switch (action.type) {
    case Chat2Gen.resetStore:
      return initialState
    // MetaMap actions
    case Chat2Gen.metasReceived:
    case Chat2Gen.metaUpdateTrustedState:
    case Chat2Gen.inboxRefresh:
    case Chat2Gen.metaHandleQueue:
    case Chat2Gen.metaNeedsUpdating:
    case Chat2Gen.metaReceivedError:
    case Chat2Gen.metaRequestTrusted:
      return state.set('metaMap', metaMapReducer(state.metaMap, action))
    // Saga only actions
    // return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default rootReducer

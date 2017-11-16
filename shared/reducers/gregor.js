// @flow
import * as Types from '../constants/types/gregor'
import * as Constants from '../constants/gregor'
import * as GregorGen from '../actions/gregor-gen'
import keyBy from 'lodash/keyBy'

export default function(state: Types.State = Constants.initialState, action: GregorGen.Actions): Types.State {
  switch (action.type) {
    case GregorGen.resetStore:
      return {...Constants.initialState}
    case GregorGen.updateSeenMsgs:
      // TODO do we ever use this?
      const newMsgs: Types.MsgMap = keyBy(action.payload.seenMsgs, m => m.md.msgID.toString('base64'))
      return {
        ...state,
        seenMsgs: {
          ...state.seenMsgs,
          ...newMsgs,
        },
      }
    case GregorGen.updateReachability:
      const {reachability} = action.payload
      return {
        ...state,
        reachability,
      }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

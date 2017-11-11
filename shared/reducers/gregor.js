// @flow
import * as Constants from '../constants/gregor'
import * as GregorGen from '../actions/gregor-gen'
import keyBy from 'lodash/keyBy'

export default function(
  state: Constants.State = Constants.initialState,
  action: GregorGen.Actions
): Constants.State {
  switch (action.type) {
    case GregorGen.resetStore:
      return {...Constants.initialState}
    case GregorGen.updateSeenMsgs:
      // TODO do we ever use this?
      const newMsgs: Constants.MsgMap = keyBy(action.payload.seenMsgs, m => m.md.msgID.toString('base64'))
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
  }
  return state
}

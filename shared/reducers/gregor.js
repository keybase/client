// @flow
import * as Types from '../constants/types/gregor'
import * as Constants from '../constants/gregor'
import * as GregorGen from '../actions/gregor-gen'
import {keyBy} from 'lodash-es'

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
    // Saga only actions
    case GregorGen.checkReachability:
    case GregorGen.injectItem:
    case GregorGen.pushOOBM:
    case GregorGen.pushState:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}

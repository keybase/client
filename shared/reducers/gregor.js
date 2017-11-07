// @flow
import * as Constants from '../constants/gregor'
import * as CommonConstants from '../constants/common'
import keyBy from 'lodash/keyBy'
import {reachabilityReachable} from '../constants/types/flow-types'

const initialState: Constants.State = {
  reachability: {reachable: reachabilityReachable.unknown},
  seenMsgs: {},
}

export default function(
  state: Constants.State = initialState,
  action: Constants.GregorActions | {type: 'common:resetStore', payload: void}
): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.updateSeenMsgs:
      // TODO do we ever use this?
      if (!action.error) {
        const newMsgs: Constants.MsgMap = keyBy(action.payload.seenMsgs, m => m.md.msgID.toString('base64'))
        return {
          ...state,
          seenMsgs: {
            ...state.seenMsgs,
            ...newMsgs,
          },
        }
      }
      break
    case Constants.updateReachability:
      const {reachability} = action.payload
      return {
        ...state,
        reachability,
      }
  }
  return state
}

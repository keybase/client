// @flow
import * as Constants from '../constants/gregor'
import * as CommonConstants from '../constants/common'
import {keyBy} from 'lodash'
import {ReachabilityReachable} from '../constants/types/flow-types'

import type {GregorActions, MsgMap} from '../constants/gregor'
import type {Reachability} from '../constants/types/flow-types'

export type State = {
  seenMsgs: MsgMap,
  reachability: Reachability,
}

const initialState: State = {
  seenMsgs: {},
  reachability: {reachable: ReachabilityReachable.unknown},
}

export default function (state: State = initialState, action: GregorActions): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState
    case Constants.updateSeenMsgs:
      if (!action.error) {
        const newMsgs: MsgMap = keyBy(action.payload.seenMsgs, m => m.md.msgID.toString('base64'))
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

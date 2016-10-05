// @flow
import * as Constants from '../constants/gregor'
import * as CommonConstants from '../constants/common'
import {keyBy} from 'lodash'

import type {GregorActions, MsgMap} from '../constants/gregor'

export type State = {
  seenMsgs: MsgMap,
}

const initialState: State = {
  seenMsgs: {},
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
  }
  return state
}

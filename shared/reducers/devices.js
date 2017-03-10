// @flow
import HiddenString from '../util/hidden-string'
import {List} from 'immutable'
import {StateRecord} from '../constants/devices'

import type {State, Actions} from '../constants/devices'

const initialState: State = new StateRecord()
const updatePaperKey = (state: State, paperKey: ?HiddenString) => state.set('paperKey', paperKey)
const updateWaitingForServer = (state: State, waiting: boolean) => state.set('waitingForServer', waiting)

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case 'common:resetStore':
      return new StateRecord()
    case 'devices:waiting':
      const {waiting} = action.payload
      return updateWaitingForServer(state, waiting)
    case 'devices:loaded':
      const {deviceIDs} = action.payload
      return state.set('deviceIDs', List(deviceIDs))
    case 'devices:paperKeyLoaded':
      return updatePaperKey(state, action.payload.paperKey)
  }

  return state
}

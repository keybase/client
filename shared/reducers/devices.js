// @flow
import {List} from 'immutable'
import {StateRecord} from '../constants/devices'

import type {State, Actions} from '../constants/devices'

const initialState: State = new StateRecord()

export default function(state: State = initialState, action: Actions) {
  switch (action.type) {
    case 'common:resetStore':
      return new StateRecord()
    case 'devices:waiting':
      const {waiting} = action.payload
      return state.set('waitingForServer', waiting)
    case 'devices:loaded':
      const {deviceIDs} = action.payload
      return state.set('deviceIDs', List(deviceIDs))
  }

  return state
}

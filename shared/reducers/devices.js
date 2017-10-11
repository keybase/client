// @flow
import {List} from 'immutable'
import {makeState, type State, type Actions} from '../constants/devices'

const initialState: State = makeState()

export default function(state: State = initialState, action: Actions) {
  switch (action.type) {
    case 'common:resetStore':
      return initialState
    case 'devices:waiting':
      const {waiting} = action.payload
      return state.set('waitingForServer', waiting)
    case 'devices:loaded':
      const {deviceIDs} = action.payload
      return state.set('deviceIDs', List(deviceIDs))
  }

  return state
}

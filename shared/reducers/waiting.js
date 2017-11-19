// @flow
import * as I from 'immutable'
import * as Constants from '../constants/waiting'
import * as Waiting from '../actions/waiting-gen'

const initialState: Constants.State = I.Map()

function reducer(state: Constants.State = initialState, action: Waiting.Actions): Constants.State {
  switch (action.type) {
    case 'common:resetStore': {
      return initialState
    }
    case Waiting.decrementWaiting: {
      const {payload: {key}} = action
      return state.update(key, 1, n => n - 1)
    }
    case Waiting.incrementWaiting: {
      const {payload: {key}} = action
      return state.update(key, 0, n => n + 1)
    }
  }

  return state
}

export default reducer

// @flow
import * as Constants from '../constants/waiting'
import * as Types from '../constants/types/waiting'
import * as Waiting from '../actions/waiting-gen'

function reducer(state: Types.State = Constants.initialState, action: Waiting.Actions): Types.State {
  switch (action.type) {
    case 'common:resetStore': {
      return Constants.initialState
    }
    case Waiting.decrementWaiting: {
      const {payload: {key}} = action
      return state.update(key, 1, n => n - 1)
    }
    case Waiting.incrementWaiting: {
      const {payload: {key}} = action
      return state.update(key, 0, n => n + 1)
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default reducer

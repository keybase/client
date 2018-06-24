// @flow
import * as Constants from '../constants/waiting'
import * as Types from '../constants/types/waiting'
import * as Waiting from '../actions/waiting-gen'

const changeHelper = (state: Types.State, keys: Array<string>, diff: 1 | -1) =>
  state.withMutations(st => {
    keys.forEach(k => st.update(k, diff === 1 ? 0 : 1, n => n + diff))
  })

function reducer(state: Types.State = Constants.initialState, action: Waiting.Actions): Types.State {
  switch (action.type) {
    case 'common:resetStore': {
      return Constants.initialState
    }
    case Waiting.decrementWaiting: {
      const {key} = action.payload
      return changeHelper(state, typeof key === 'string' ? [key] : key, -1)
    }
    case Waiting.incrementWaiting: {
      const {key} = action.payload
      return changeHelper(state, typeof key === 'string' ? [key] : key, 1)
    }
    case Waiting.changeWaiting: {
      const {key, increment} = action.payload
      return changeHelper(state, typeof key === 'string' ? [key] : key, increment ? 1 : -1)
    }
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}

export default reducer

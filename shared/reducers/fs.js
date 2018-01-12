// @flow
import * as FSGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: FSGen.Actions) {
  switch (action.type) {
    case FSGen.resetStore:
      return initialState
    case FSGen.increaseCount: {
      const {amount = 1} = action.payload
      return state.withMutations(s => s.set('counter', state.counter + amount))
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

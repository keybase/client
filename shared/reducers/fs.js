// @flow
import * as I from 'immutable'
import * as FSGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: FSGen.Actions) {
  switch (action.type) {
    case FSGen.resetStore:
      return initialState
    case FSGen.folderListLoaded:
      return state.mergeIn(['pathItems'], action.payload.pathItems)
    case FSGen.folderListLoad:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

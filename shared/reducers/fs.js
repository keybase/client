// @flow
import * as FSGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: FSGen.Actions) {
  switch (action.type) {
    case FSGen.resetStore:
      return initialState
    case FSGen.folderListLoaded:
      const toMerge = action.payload.pathItems.map((item, path) => {
        if (item.type !== 'folder') {
          return item
        }
        const original = state.pathItems.get(path)
        if (original && original.progress === 'loaded' && item.progress === 'pending') {
          // Don't override a loaded item into pending. This is specifically
          // for the case where user goes back out of a folder where we could
          // override the folder into an empty one. With this, next user
          // navigates into the folder they would see the old list (instead of
          // placeholder), which then gets updated when we hear back from RPC.
          return original
        }
        return item
      })
      return state.mergeIn(['pathItems'], toMerge)
    case FSGen.folderListLoad:
      return state
    case FSGen.sortSetting:
      return state.setIn(['pathUserSettings', action.payload.path, 'sort'], action.payload.sortSetting)
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

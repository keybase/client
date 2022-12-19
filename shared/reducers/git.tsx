import type * as Types from '../constants/types/git'
import * as GitGen from '../actions/git-gen'
import * as Container from '../util/container'

const initialState: Types.State = {
  idToInfo: new Map(),
  isNew: new Set(),
}

const clearErrors = (draftState: Container.Draft<Types.State>) => {
  draftState.error = undefined
}

export default Container.makeReducer<GitGen.Actions, Types.State>(initialState, {
  [GitGen.resetStore]: () => initialState,
  [GitGen.loaded]: (draftState, action) => {
    draftState.idToInfo = action.payload.repos
  },
  [GitGen.setError]: (draftState, action) => {
    draftState.error = action.payload.error
  },
  [GitGen.badgeAppForGit]: (draftState, action) => {
    // We show our badges until we clear with the clearBadges call. If there are no badges we likely cleared it from the nav ourselves
    if (action.payload.ids.size !== 0) {
      draftState.isNew = action.payload.ids
    }
  },
  [GitGen.clearBadges]: draftState => {
    draftState.isNew = initialState.isNew
  },
  // Clear errors
  [GitGen.createPersonalRepo]: clearErrors,
  [GitGen.createTeamRepo]: clearErrors,
  [GitGen.deletePersonalRepo]: clearErrors,
  [GitGen.deleteTeamRepo]: clearErrors,
  [GitGen.loadGit]: clearErrors,
})

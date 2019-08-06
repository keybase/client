import {produce} from 'immer'
import * as Types from '../constants/types/git'
import * as GitGen from '../actions/git-gen'

const initialState: Types.State = {
  idToInfo: new Map(),
  isNew: new Set(),
}

export default (state: Types.State = initialState, action: GitGen.Actions) =>
  produce(state, draftState => {
    switch (action.type) {
      case GitGen.resetStore:
        return initialState
      case GitGen.loaded:
        draftState.idToInfo = action.payload.repos
        return draftState
      case GitGen.setError:
        draftState.error = action.payload.error
        return draftState
      case GitGen.badgeAppForGit:
        // We show our badges until we clear with the clearBadges call. If there are no badges we likely cleared it from the nav ourselves
        if (action.payload.ids.size === 0) {
          return draftState
        }
        draftState.isNew = action.payload.ids
        return draftState
      case GitGen.clearBadges:
        draftState.isNew = initialState.isNew
        return draftState
      // Clear errors
      case GitGen.loadGit:
      case GitGen.createPersonalRepo:
      case GitGen.createTeamRepo:
      case GitGen.deletePersonalRepo:
      case GitGen.deleteTeamRepo:
        draftState.error = undefined
        return draftState
      // Saga only actions
      case GitGen.navToGit:
      case GitGen.navigateToTeamRepo:
      case GitGen.repoCreated:
      case GitGen.repoDeleted:
      case GitGen.setTeamRepoSettings:
        return draftState
    }
  })

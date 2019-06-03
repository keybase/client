import * as I from 'immutable'
import * as Constants from '../constants/git'
import * as Types from '../constants/types/git'
import * as GitGen from '../actions/git-gen'

const initialState: Types.State = Constants.makeState()

export default function(state: Types.State = initialState, action: GitGen.Actions): Types.State {
  switch (action.type) {
    case GitGen.resetStore:
      return initialState
    case GitGen.loaded:
      return state.merge({
        idToInfo: I.Map(action.payload.repos),
      })
    case GitGen.setError:
      return state.merge({error: action.payload.error})
    case GitGen.badgeAppForGit:
      const newSet = I.Set<string>(action.payload.ids)
      // We show our badges until we clear with the clearBadges call. If there are no badges we likely cleared it from the nav ourselves
      if (newSet.isEmpty()) {
        return state
      }
      return state.merge({isNew: newSet})
    case GitGen.clearBadges:
      return state.merge({isNew: I.Set()})
    // Clear errors
    case GitGen.loadGit:
    case GitGen.createPersonalRepo:
    case GitGen.createTeamRepo:
    case GitGen.deletePersonalRepo:
    case GitGen.deleteTeamRepo:
      return state.merge({error: null})
    // Saga only actions
    case GitGen.navToGit:
    case GitGen.navigateToTeamRepo:
    case GitGen.repoCreated:
    case GitGen.repoDeleted:
    case GitGen.setTeamRepoSettings:
      return state
    default:
      return state
  }
}

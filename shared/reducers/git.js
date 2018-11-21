// @flow
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
        lastLoad: Date.now(),
      })
    case GitGen.setError:
      return state.merge({error: action.payload.error})
    case GitGen.badgeAppForGit:
      return state.merge({isNew: I.Set(action.payload.ids)})
    // Clear errors
    case GitGen.loadGit:
    case GitGen.loadGitRepo:
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
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}

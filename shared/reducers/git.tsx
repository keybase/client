// import type * as Types from '../constants/types/git'
// import * as GitGen from '../actions/git-gen'
// import * as Container from '../util/container'

// const initialState: Types.State = {
//   idToInfo: new Map(),
//   isNew: new Set(),
// }

// const clearErrors = (draftState: Container.Draft<Types.State>) => {
//   draftState.error = undefined
// }

// export default Container.makeReducer<GitGen.Actions, Types.State>(initialState, {
//   [GitGen.resetStore]: () => initialState,
//   [GitGen.setError]: (draftState, action) => {
//     draftState.error = action.payload.error
//   },
//   // Clear errors
//   [GitGen.createPersonalRepo]: clearErrors,
//   [GitGen.createTeamRepo]: clearErrors,
//   [GitGen.deletePersonalRepo]: clearErrors,
//   [GitGen.deleteTeamRepo]: clearErrors,
//   [GitGen.loadGit]: clearErrors,
// })
export {}

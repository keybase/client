import * as Constants from '../constants/config'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import type * as Types from '../constants/types/config'

type Actions = ConfigGen.Actions

export default Container.makeReducer<Actions, Types.State>(Constants.initialState, {
  [ConfigGen.resetStore]: () => ({
    ...Constants.initialState,
  }),
  [ConfigGen.setStartupFile]: (draftState, action) => {
    draftState.startupFile = action.payload.startupFile
  },
  [ConfigGen.bootstrapStatusLoaded]: (draftState, action) => {
    draftState.loggedIn = action.payload.loggedIn
  },
  [ConfigGen.loggedIn]: draftState => {
    draftState.loggedIn = true
  },
  [ConfigGen.loggedOut]: draftState => {
    draftState.loggedIn = false
  },
})

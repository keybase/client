import * as Constants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as EngineGen from '../actions/engine-gen-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import type * as GregorGen from '../actions/gregor-gen'
import type * as Types from '../constants/types/config'
import type * as Tracker2Gen from '../actions/tracker2-gen'
import {isMobile} from '../constants/platform'

type Actions =
  | ConfigGen.Actions
  | Tracker2Gen.UpdatedDetailsPayload
  | EngineGen.Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload
  | EngineGen.Keybase1NotifyTeamAvatarUpdatedPayload
  | GregorGen.PushStatePayload

export default Container.makeReducer<Actions, Types.State>(Constants.initialState, {
  [ConfigGen.resetStore]: draftState => ({
    ...Constants.initialState,
    startupDetailsLoaded: draftState.startupDetailsLoaded,
    userSwitching: draftState.userSwitching,
  }),
  [ConfigGen.setStartupDetails]: (draftState, action) => {
    if (!draftState.startupDetailsLoaded) {
      draftState.startupDetailsLoaded = true
      draftState.startupConversation = action.payload.startupConversation || ChatConstants.noConversationIDKey
      draftState.startupPushPayload = action.payload.startupPushPayload
      draftState.startupFollowUser = action.payload.startupFollowUser
      draftState.startupLink = action.payload.startupLink
      draftState.startupTab = action.payload.startupTab
      draftState.startupWasFromPush = action.payload.startupWasFromPush
    }
  },
  [ConfigGen.setStartupFile]: (draftState, action) => {
    draftState.startupFile = action.payload.startupFile
  },
  [ConfigGen.bootstrapStatusLoaded]: (draftState, action) => {
    draftState.loggedIn = action.payload.loggedIn
    if (action.payload.loggedIn) {
      draftState.userSwitching = false
    }
  },
  [ConfigGen.loggedIn]: draftState => {
    draftState.loggedIn = true
  },
  [ConfigGen.loggedOut]: draftState => {
    draftState.loggedIn = false
  },
  [ConfigGen.changedActive]: (draftState, action) => {
    draftState.userActive = action.payload.userActive
  },
  [ConfigGen.setUserSwitching]: (draftState, action) => {
    draftState.userSwitching = action.payload.userSwitching
  },
  [ConfigGen.daemonHandshakeDone]: draftState => {
    draftState.startupDetailsLoaded = isMobile ? draftState.startupDetailsLoaded : true
  },
  [ConfigGen.setWhatsNewLastSeenVersion]: (draftState, action) => {
    draftState.whatsNewLastSeenVersion = action.payload.lastSeenVersion
  },
})

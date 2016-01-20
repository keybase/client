/* @flow */

import * as Constants from '../constants/config'
import * as LoginConstants from '../constants/login'

import type {Action} from '../constants/types/flux'
import type {NavState} from '../constants/config'
import type {Config, GetCurrentStatusRes} from '../constants/types/flow-types'

export type ConfigState = {
  navState: NavState;
  status: ?GetCurrentStatusRes;
  config: ?Config;
  error: ?any;
  devConfig: ?any;
}

const initialState: ConfigState = {
  navState: Constants.navStartingUp,
  status: null,
  config: null,
  error: null,
  devConfig: null
}

export default function (state: ConfigState = initialState, action: Action): ConfigState {
  switch (action.type) {
    case Constants.startupLoading:
      return {
        ...state,
        navState: Constants.navStartingUp,
        config: null,
        status: null,
        error: null
      }

    case Constants.configLoaded:
      if (action.payload && action.payload.config) {
        return {
          ...state,
          config: action.payload.config
        }
      }
      return state

    case Constants.statusLoaded:
      if (action.payload && action.payload.status) {
        return {
          ...state,
          status: action.payload.status
        }
      }
      return state

    case Constants.startupLoaded:
      let navState = Constants.navStartingUp

      if (!action.error) {
        if (state.status && !state.status.registered) {
          navState = Constants.navNeedsRegistration
        } else if (state.status && state.status.loggedIn) {
          navState = Constants.navNeedsLogin
        }
      } else {
        navState = Constants.navErrorStartingUp
      }

      return {
        ...state,
        error: action.error ? action.payload : null,
        navState
      }
    case LoginConstants.logoutDone:
      return {
        ...state,
        navState: Constants.navNeedsLogin
      }
    case LoginConstants.loginDone:
      return {
        ...state,
        error: action.error ? action.payload : null,
        navState: action.error ? Constants.navErrorStartingUp : Constants.navLoggedIn
      }
    case Constants.devConfigLoading:
      return {
        ...state,
        devConfig: null
      }
    case Constants.devConfigLoaded:
      return {
        ...state,
        devConfig: action.payload.devConfig
      }
    case Constants.devConfigSaved:
      return {
        ...state,
        devConfig: null
      }
    case Constants.devConfigUpdate:
      const devConfigured = state.devConfig && state.devConfig.configured || {}
      return {
        ...state,
        devConfig: {
          ...state.devConfig,
          configured: {
            ...devConfigured,
            ...action.payload.updates
          }
        }
      }
    default:
      return state
  }
}

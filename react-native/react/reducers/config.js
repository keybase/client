/* @flow */
'use strict'

import * as Constants from '../constants/config'
import * as LoginConstants from '../constants/login2'

type NavState = 'navStartingUp' | 'navNeedsRegistration' | 'navNeedsLogin' | 'navLoggedIn'

type ConfigState = {
  navState: NavState;
  status: ?any;
  config: ?any;
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

export default function (state: ConfigState = initialState, action: any): ConfigState {
  switch (action.type) {
    case Constants.startupLoading:
      return {
        ...state,
        navState: Constants.navStartingUp,
        config: null,
        status: null,
        error: null
      }
    case Constants.startupLoaded:
      let navState = Constants.navStartingUp

      if (!action.error) {
        if (!action.payload.status.registered) {
          navState = Constants.navNeedsRegistration
        } else if (!action.payload.status.loggedIn) {
          navState = Constants.navNeedsLogin
        }
      }

      return {
        ...state,
        config: action.error ? null : action.payload.config,
        status: action.error ? null : action.payload.status,
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
        navState: Constants.navLoggedIn
      }
    case Constants.devConfigLoading:
      return {
        ...state,
        devConfig: null
      }
    case Constants.devConfigLoaded:
      return {
        ...state,
        devConfig: action.devConfig
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
            ...action.updates
          }
        }
      }
    default:
      return state
  }
}

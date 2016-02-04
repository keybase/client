/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {createRouterState} from './reducers/router'
import * as Tabs from './constants/tabs'
import {updateConfig} from './command-line.desktop.js'

let config = {
  overrideRouterState: null,
  overrideActiveTab: null,
  skipLoginRouteToRoot: false,
  allowStartupFailure: false,
  printRPC: false,
  showDevTools: false,
  showAllTrackers: false,
  showMainWindow: false,
  reduxDevToolsEnable: false,
  redirectOnLogout: true,
  reduxDevToolsSelect: state => state, // only watch a subset of the store
  enableStoreLogging: false,
  enableActionLogging: true,
  forwardLogs: true,
  devStoreChangingFunctions: false,
  resizeLoginForm: true,
  trackerVersionTwo: false
}

if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) { // eslint-disable-line no-undef
  config.overrideRouterState = createRouterState(['devMenu', 'components'], [])
  config.overrideActiveTab = Tabs.moreTab
  config.skipLoginRouteToRoot = true
  config.allowStartupFailure = true
  config.printRPC = true
  config.showDevTools = false
  config.showMainWindow = true
  config.showAllTrackers = true
  config.reduxDevToolsEnable = false
  config.redirectOnLogout = false
  config.reduxDevToolsSelect = state => state.tracker
  config.enableStoreLogging = true
  config.enableActionLogging = false
  config.forwardLogs = true
  config.devStoreChangingFunctions = true
  config.resizeLoginForm = false
}

if (__DEV__ && process.env.KEYBASE_TRACKER_V2) { // eslint-disable-line no-undef
  config.trackerVersionTwo = true
}

config = updateConfig(config)

export const {
  enableActionLogging,
  overrideRouterState,
  overrideActiveTab,
  skipLoginRouteToRoot,
  allowStartupFailure,
  printRPC,
  showDevTools,
  showMainWindow,
  showAllTrackers,
  reduxDevToolsSelect,
  enableStoreLogging,
  forwardLogs,
  devStoreChangingFunctions,
  resizeLoginForm,
  trackerVersionTwo
} = config

/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {createRouterState} from './reducers/router'
import * as Tabs from './constants/tabs'

let config = {
  overrideRouterState: null,
  overrideActiveTab: null,
  skipLoginRouteToRoot: false,
  allowStartupFailure: false,
  printRPC: false
}

if (__DEV__ && false) { // eslint-disable-line no-undef
  config.overrideRouterState = createRouterState([], [])
  config.overrideActiveTab = Tabs.devicesTab
  config.skipLoginRouteToRoot = true
  config.allowStartupFailure = true
  config.printRPC = true
}

export const {
  overrideRouterState,
  overrideActiveTab,
  skipLoginRouteToRoot,
  allowStartupFailure,
  printRPC
} = config

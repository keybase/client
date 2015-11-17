'use strict'
/*
 * File to stash local debug changes to. Never check this in with changes
 * @flow
 */

import { createRouterState } from './reducers/router'
import * as Tabs from './constants/tabs'
import { isDev } from './constants/platform'

let config = {
  overrideRouterState: null,
  overrideActiveTab: null,
  skipLoginRouteToRoot: false,
  allowStartupFailure: false
}

if (isDev && true) {
  config.overrideRouterState = createRouterState([], [])
  config.overrideActiveTab = Tabs.foldersTab
  config.skipLoginRouteToRoot = true
  config.allowStartupFailure = true
}

export const {
  overrideRouterState,
  overrideActiveTab,
  skipLoginRouteToRoot,
  allowStartupFailure
} = config

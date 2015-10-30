'use strict'
/*
 * File to stash local debug changes to. Never check this in with changes
 * @flow
 */

import { createRouterState } from './reducers/router'
import * as Tabs from './constants/tabs'

let config = {
  overrideRouterState: null,
  overrideActiveTab: null,
  skipLoginRouteToRoot: false,
  allowStartupFailure: false
}

/* eslint-disable no-undef */
if (__DEV__ && true) {
/* eslint-enable no-undef */
  config.overrideRouterState = createRouterState(['login2', 'register'], [])
  config.overrideActiveTab = Tabs.MORE_TAB
  config.skipLoginRouteToRoot = true
  config.allowStartupFailure = true
}

export const {
  overrideRouterState,
  overrideActiveTab,
  skipLoginRouteToRoot,
  allowStartupFailure
} = config

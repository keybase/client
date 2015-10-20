'use strict'
/*
 * File to stash local debug changes to. Never check this in with changes
 * @flow
 */

import { createRouterState } from './reducers/router'
import * as Tabs from './constants/tabs'

/* eslint-disable no-undef */
let routerState = null
let activeTab = null
let skipRouteToRoot = false

if (__DEV__) {
  routerState = createRouterState(['root'], [])
  activeTab = Tabs.DEVICES_TAB
  skipRouteToRoot = true
}

export const overrideRouterState = routerState
export const overrideActiveTab = activeTab
export const skipLoginRouteToRoot = skipRouteToRoot
/* eslint-enable no-undef */

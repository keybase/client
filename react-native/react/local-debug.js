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

if (__DEV__) {
  routerState = createRouterState([], [])
  activeTab = Tabs.MORE_TAB
}

export const overrideRouterState = routerState
export const overrideActiveTab = activeTab
/* eslint-enable no-undef */

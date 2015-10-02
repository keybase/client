'use strict'

import { SWITCH_TAB } from '../constants/tabbedRouterActionTypes'

export function switchTab (tabName) {
  return {
    tabName,
    type: SWITCH_TAB
  }
}

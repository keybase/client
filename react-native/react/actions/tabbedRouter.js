'use strict'

import * as types from '../constants/tabbedRouterActionTypes'

export function switchTab (tabName) {
  return {
    tabName,
    type: types.SWITCH_TAB
  }
}

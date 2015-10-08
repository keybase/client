'use strict'

import * as types from '../constants/tabbed-router-action-types'

export function switchTab (tabName) {
  return {
    tabName,
    type: types.SWITCH_TAB
  }
}

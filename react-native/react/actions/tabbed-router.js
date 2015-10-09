'use strict'

import { SWITCH_TAB } from '../constants/tabbed-router-action-types'

export function switchTab (tabName) {
  return {
    tabName,
    type: SWITCH_TAB
  }
}

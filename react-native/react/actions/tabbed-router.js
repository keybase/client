'use strict'

import { SWITCH_TAB } from '../constants/tabbed-router'

export function switchTab (tabName) {
  return {
    tabName,
    type: SWITCH_TAB
  }
}

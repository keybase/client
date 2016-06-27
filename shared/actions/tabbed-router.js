// @flow
import * as Constants from '../constants/tabbed-router'

import type {Tabs} from '../constants/tabs'

export function switchTab (tabName: Tabs) {
  return {
    type: Constants.switchTab,
    payload: tabName,
  }
}

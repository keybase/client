import * as Constants from '../constants/tabbed-router'

export function switchTab (tabName) {
  return {
    type: Constants.switchTab,
    payload: tabName,
  }
}

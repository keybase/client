// @flow
import * as Constants from '../constants/tabbed-router'

export function switchTab (tabName: string) {
  return {
    type: Constants.switchTab,
    payload: tabName
  }
}

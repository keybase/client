'use strict'

const types = require('../constants/tabbedRouterActionTypes')

function switchTab (tabName) {
  return {
    tabName,
    type: types.SWITCH_TAB
  }
}

module.exports.switchTab = switchTab

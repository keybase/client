'use strict'

const types = require('../constants/routerActionTypes')

module.exports.navigateUp = function () {
  return {
    type: types.NAVIGATE_UP
  }
}

module.exports.navigateTo = function (uri) {
  return {
    type: types.NAVIGATE,
    uri: uri
  }
}

module.exports.routeAppend = function (routeStr) {
  return {
    type: types.NAVIGATE_APPEND,
    topRoute: routeStr
  }
}

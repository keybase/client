/* global exports, require */
const core = require('./react-navigation-core.js')

Object.assign(exports, core)

exports.useRoute = () => ({key: 'mock-route', name: 'mock', params: {}})
exports.useNavigationState = selector => selector({index: 0, key: 'nav-state', routeNames: [], routes: [], stale: false, type: 'tab'})
exports.NavigationContainer = core.useNavigationBuilder
exports.createStaticNavigation = () => () => null

// @flow
import SettingsContainer from './render'
import pausableConnect from '../util/pausable-connect'
import {switchTo} from '../actions/route-tree'
import {logout} from '../actions/login/creators'

import type {RouteProps} from '../route-tree/render-route'

// $FlowIssue type this connector
export default pausableConnect(
  (state, {isActiveRoute, routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({
    isActiveRoute,
    badgeNumbers: {}, // TODO add badging logic
    selectedTab: routeSelected,
    isModal: routeLeafTags.modal,
  }),
  (dispatch, {routePath}: RouteProps<{}, {}>) => ({
    onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
    onLogout: () => dispatch(logout()),
  })
)(SettingsContainer)

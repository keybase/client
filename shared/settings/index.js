// @flow
import SettingsContainer from './render'
import {connect} from 'react-redux'
import cacheWhenRouteInactive from '../route-tree/cache-inactive-connect'
import {switchTo} from '../actions/route-tree'
import {logout} from '../actions/login/creators'

import type {RouteProps} from '../route-tree/render-route'

const mapStateToProps = (state, {routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({
  badgeNumbers: {}, // TODO add badging logic
  selectedTab: routeSelected,
  isModal: routeLeafTags.modal,
})

const mapDispatchToProps = (dispatch, {routePath}: RouteProps<{}, {}>) => ({
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
  onLogout: () => dispatch(logout()),
})

// $FlowIssue type this connector
export default connect(cacheWhenRouteInactive(mapStateToProps), mapDispatchToProps)(SettingsContainer)

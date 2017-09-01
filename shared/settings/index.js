// @flow
import SettingsContainer from './render'
import pausableConnect from '../util/pausable-connect'
import {switchTo} from '../actions/route-tree'
import {logout} from '../actions/login/creators'

import type {TypedState} from '../constants/reducer'
import type {RouteProps} from '../route-tree/render-route'

const mapStateToProps = (state: TypedState, {routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({
  badgeNumbers: {}, // TODO add badging logic
  isModal: routeLeafTags.modal,
  selectedTab: routeSelected,
})

// $FlowIssue type this connector
export default pausableConnect(mapStateToProps, (dispatch, {routePath}: RouteProps<{}, {}>) => ({
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
  onLogout: () => dispatch(logout()),
}))(SettingsContainer)

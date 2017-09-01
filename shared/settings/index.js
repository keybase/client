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

const mapDispatchToProps = (dispatch: Dispatch, {routePath}: RouteProps<{}, {}>) => ({
  onLogout: () => dispatch(logout()),
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
})

export default pausableConnect(mapStateToProps, mapDispatchToProps)(SettingsContainer)

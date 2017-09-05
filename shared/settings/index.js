// @flow
import SettingsContainer from './render'
import pausableConnect from '../util/pausable-connect'
import {switchTo} from '../actions/route-tree'
import {logout} from '../actions/login/creators'

import type {Tab} from '../constants/settings'
import type {TypedState} from '../constants/reducer'
import type {RouteProps} from '../route-tree/render-route'

type StateProps = {
  badgeNumbers: {[key: Tab]: number},
  isModal: boolean,
  selectedTab: Tab,
}

const mapStateToProps = (
  state: TypedState,
  {routeLeafTags, routeSelected}: RouteProps<{}, {}>
): StateProps => ({
  badgeNumbers: {}, // TODO add badging logic
  isModal: routeLeafTags.modal,
  // TODO: Is there a way to validate that routeSelected is a Tab?
  selectedTab: (routeSelected: any),
})

type DispatchProps = {
  onLogout: () => void,
  onTabChange: (tab: Tab) => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}: RouteProps<{}, {}>): DispatchProps => ({
  onLogout: () => dispatch(logout()),
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
})

export default pausableConnect(mapStateToProps, mapDispatchToProps)(SettingsContainer)

// @flow
import * as LoginGen from '../actions/login-gen'
import SettingsContainer from './render'
import {connect, type TypedState} from '../util/container'
import {switchTo} from '../actions/route-tree'
import {type RouteProps} from '../route-tree/render-route'
import {type Tab} from '../constants/types/settings'

const getNavBadges = (state: TypedState) => state.notifications.get('navBadges')

type StateProps = {
  badgeNumbers: {[key: Tab]: number},
  isModal: boolean,
  selectedTab: Tab,
}

const mapStateToProps = (
  state: TypedState,
  {routeLeafTags, routeSelected}: RouteProps<{}, {}>
): StateProps => {
  // $FlowIssue
  const badgeNumbers: {[key: Tab]: number} = getNavBadges(state).toObject()
  return {
    badgeNumbers,
    isModal: routeLeafTags.modal,
    // TODO: Is there a way to validate that routeSelected is a Tab?
    selectedTab: (routeSelected: any),
  }
}

type DispatchProps = {
  onLogout: () => void,
  onTabChange: (tab: Tab) => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}: RouteProps<{}, {}>): DispatchProps => ({
  onLogout: () => dispatch(LoginGen.createLogout()),
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
})

export default connect(mapStateToProps, mapDispatchToProps)(SettingsContainer)

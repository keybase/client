// @flow
import * as LoginGen from '../actions/login-gen'
import SettingsContainer from './render'
import {pausableConnect, type TypedState} from '../util/container'
import {switchTo} from '../actions/route-tree'
import {type RouteProps} from '../route-tree/render-route'
import {type Tab} from '../constants/types/settings'
import * as PushConstants from '../constants/push'

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
    badgePushNotification: PushConstants.showSettingsBadge(state),
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

export default pausableConnect(mapStateToProps, mapDispatchToProps)(SettingsContainer)

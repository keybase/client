// @flow
import * as LoginGen from '../actions/login-gen'
import SettingsContainer from './render'
import {connect, type TypedState} from '../util/container'
import {switchTo} from '../actions/route-tree'
import {type RouteProps} from '../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState, {routeLeafTags, routeSelected}: OwnProps) => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  badgeNotifications: !state.push.hasPermissions,
  isModal: routeLeafTags.modal,
  // TODO: Is there a way to validate that routeSelected is a Tab?
  selectedTab: (routeSelected: any),
})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}: OwnProps) => ({
  onLogout: () => dispatch(LoginGen.createLogout()),
  onTabChange: tab => dispatch(switchTo(routePath.push(tab))),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNotifications: stateProps.badgeNotifications,
  badgeNumbers: stateProps._badgeNumbers.toObject(),
  children: ownProps.children,
  isModal: stateProps.isModal,
  selectedTab: stateProps.selectedTab,
  ...dispatchProps,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SettingsContainer)

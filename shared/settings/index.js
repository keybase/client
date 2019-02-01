// @flow
import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Types from '../constants/types/settings'
import * as RouteTreeGen from '../actions/route-tree-gen'
import SettingsContainer from './render'
import {compose} from 'recompose'
import {connect, lifecycle} from '../util/container'
import {type RouteProps} from '../route-tree/render-route'

type OwnProps = {|children: React.Node, ...$Exact<RouteProps<{}, {}>>|}

const mapStateToProps = (state, {routeLeafTags, routeSelected}: OwnProps) => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  badgeNotifications: !state.push.hasPermissions,
  hasRandomPW: state.settings.passphrase.randomPW,
  isModal: routeLeafTags.modal,
  logoutHandshakeWaiters: state.config.logoutHandshakeWaiters,
  selectedTab: ((routeSelected: any): Types.Tab),
})

const mapDispatchToProps = (dispatch, {routePath}: OwnProps) => ({
  _loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
  onLogout: () => dispatch(ConfigGen.createLogout()),
  onTabChange: (tab: Types.Tab) => dispatch(RouteTreeGen.createSwitchTo({path: routePath.push(tab)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _loadHasRandomPW: dispatchProps._loadHasRandomPW,
  badgeNotifications: stateProps.badgeNotifications,
  badgeNumbers: stateProps._badgeNumbers.toObject(),
  children: ownProps.children,
  hasRandomPW: stateProps.hasRandomPW,
  isModal: stateProps.isModal,
  logoutInProgress: stateProps.logoutHandshakeWaiters.size > 0,
  onLogout: dispatchProps.onLogout,
  onTabChange: dispatchProps.onTabChange,
  selectedTab: stateProps.selectedTab,
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadHasRandomPW()
    },
  })
)(SettingsContainer)

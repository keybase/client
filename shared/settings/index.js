// @flow
import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Constants from '../constants/settings'
import * as Types from '../constants/types/settings'
import * as RouteTreeGen from '../actions/route-tree-gen'
import SettingsContainer from './render'
import {compose} from 'recompose'
import {connect, lifecycle} from '../util/container'
import {requestIdleCallback} from '../util/idle-callback'
import {type RouteProps} from '../route-tree/render-route'
import flags from '../util/feature-flags'

type OwnProps = {|children: React.Node, ...$Exact<RouteProps<{}, {}>>|}

const mapStateToProps = (state, {routeLeafTags, routeSelected}: OwnProps) => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  _walletsAcceptedDisclaimer: state.wallets.acceptedDisclaimer,
  badgeNotifications: !state.push.hasPermissions,
  hasRandomPW: state.settings.password.randomPW,
  isModal: routeLeafTags.modal,
  logoutHandshakeWaiters: state.config.logoutHandshakeWaiters,
  selectedTab: ((routeSelected: any): Types.Tab),
})

const mapDispatchToProps = (dispatch, {routePath}: OwnProps) => ({
  _loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
  onLogout: () => dispatch(ConfigGen.createLogout()),
  onTabChange: (tab: Types.Tab, walletsAcceptedDisclaimer: boolean) => {
    if (flags.useNewRouter && tab === Constants.walletsTab && !walletsAcceptedDisclaimer) {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
      return
    }
    dispatch(RouteTreeGen.createSwitchTo({path: routePath.push(tab)}))
  },
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
  onTabChange: tab => dispatchProps.onTabChange(tab, stateProps._walletsAcceptedDisclaimer),
  selectedTab: stateProps.selectedTab,
})

const Connected = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      const loadHasRandomPW = this.props._loadHasRandomPW
      requestIdleCallback(loadHasRandomPW)
    },
  })
)(SettingsContainer)

// $FlowIssue lets fix this
Connected.navigationOptions = {
  header: undefined,
  title: 'Settings',
}

export default Connected

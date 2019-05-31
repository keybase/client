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
import {RouteProps} from '../route-tree/render-route'

type OwnProps = {
  routeSelected: string
  children: React.ReactNode
} & RouteProps<{}, {}>

const mapStateToProps = (state, {routeSelected}: OwnProps) => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  _walletsAcceptedDisclaimer: state.wallets.acceptedDisclaimer,
  badgeNotifications: !state.push.hasPermissions,
  hasRandomPW: state.settings.password.randomPW,
  isModal: false,
  logoutHandshakeWaiters: state.config.logoutHandshakeWaiters,
  selectedTab: routeSelected,
})

const mapDispatchToProps = dispatch => ({
  _loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
  onLogout: () => dispatch(ConfigGen.createLogout()),
  onTabChange: (tab: Types.Tab, walletsAcceptedDisclaimer: boolean) => {
    if (tab === Constants.walletsTab && !walletsAcceptedDisclaimer) {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
      return
    }
    dispatch(RouteTreeGen.createSwitchTo({path: [tab]}))
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
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      // @ts-ignore NO recompose
      const loadHasRandomPW = this.props._loadHasRandomPW
      requestIdleCallback(loadHasRandomPW)
    },
  })
)(SettingsContainer)

// @ts-ignore TODO fix
Connected.navigationOptions = {
  header: null,
}

export default Connected

import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Constants from '../constants/settings'
import * as Types from '../constants/types/settings'
import * as RouteTreeGen from '../actions/route-tree-gen'
import SettingsContainer, {Props} from './render'
import * as Container from '../util/container'

type OwnProps = {
  children: React.ReactNode
}

const Connected = Container.connect(
  (state: Container.TypedState) => ({
    _badgeNumbers: state.notifications.navBadges,
    _logoutHandshakeWaiters: state.config.logoutHandshakeWaiters,
    _walletsAcceptedDisclaimer: state.wallets.acceptedDisclaimer,
    badgeNotifications: !state.push.hasPermissions,
    hasRandomPW: state.settings.password.randomPW,
  }),
  (dispatch: Container.TypedDispatch) => ({
    loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
    onLogout: () => dispatch(ConfigGen.createLogout()),
    onTabChange: (tab: Types.Tab, walletsAcceptedDisclaimer: boolean) => {
      if (tab === Constants.walletsTab && !walletsAcceptedDisclaimer) {
        dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
        return
      }
      // TODO this logic is broken, routeSelected is never a real value in nav2
      // if (ownProps.routeSelected === Constants.accountTab && tab !== Constants.accountTab) {
      // dispatch(SettingsGen.createClearAddedEmail())
      // }
      dispatch(RouteTreeGen.createNavigateAppend({path: [tab]}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    badgeNotifications: stateProps.badgeNotifications,
    badgeNumbers: (stateProps._badgeNumbers.toObject() as unknown) as Props['badgeNumbers'],
    children: ownProps.children,
    hasRandomPW: stateProps.hasRandomPW || undefined,
    loadHasRandomPW: dispatchProps.loadHasRandomPW,
    logoutInProgress: stateProps._logoutHandshakeWaiters.size > 0,
    onLogout: dispatchProps.onLogout,
    onTabChange: (tab: Types.Tab) => dispatchProps.onTabChange(tab, stateProps._walletsAcceptedDisclaimer),
    selectedTab: Constants.aboutTab as Types.Tab, // TODO plumb this through correctly, is null always w/ nav2
  })
)(SettingsContainer)

// @ts-ignore TODO fix
Connected.navigationOptions = {
  header: null,
}

export default Connected

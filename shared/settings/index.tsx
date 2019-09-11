import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Constants from '../constants/settings'
import * as RouteTreeGen from '../actions/route-tree-gen'
import SettingsContainer from './render'
import * as Container from '../util/container'

type OwnProps = {
  children: React.ReactNode
  routeSelected: Constants.SettingsTab
}

const Connected = Container.connect(
  (state: Container.TypedState) => ({
    _badgeNumbers: state.notifications.navBadges,
    _contactImportEnabled: state.settings.contacts.importEnabled,
    _walletsAcceptedDisclaimer: state.wallets.acceptedDisclaimer,
    badgeNotifications: !state.push.hasPermissions,
    hasRandomPW: state.settings.password.randomPW,
    logoutInProgress: state.config.logoutHandshakeWaiters.size > 0,
  }),
  (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
    loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
    onLogout: () => dispatch(ConfigGen.createLogout()),
    onTabChange: (tab: Constants.SettingsTab, walletsAcceptedDisclaimer: boolean) => {
      if (tab === Constants.walletsTab && !walletsAcceptedDisclaimer) {
        dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
        return
      }
      if (ownProps.routeSelected === Constants.accountTab && tab !== Constants.accountTab) {
        dispatch(SettingsGen.createClearAddedEmail())
      }
      dispatch(RouteTreeGen.createNavigateAppend({path: [tab]}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    badgeNotifications: stateProps.badgeNotifications,
    badgeNumbers: stateProps._badgeNumbers,
    children: ownProps.children,
    contactsLabel: stateProps._contactImportEnabled ? 'Phone contacts' : 'Import phone contacts',
    hasRandomPW: stateProps.hasRandomPW || undefined,
    loadHasRandomPW: dispatchProps.loadHasRandomPW,
    logoutInProgress: stateProps.logoutInProgress,
    onLogout: dispatchProps.onLogout,
    onTabChange: (tab: Constants.SettingsTab) =>
      dispatchProps.onTabChange(tab, stateProps._walletsAcceptedDisclaimer),
    selectedTab: ownProps.routeSelected,
  })
)(SettingsContainer)

export default Connected

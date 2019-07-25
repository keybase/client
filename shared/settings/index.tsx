import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Constants from '../constants/settings'
import * as Types from '../constants/types/settings'
import * as RouteTreeGen from '../actions/route-tree-gen'
import SettingsContainer from './render'
import {compose} from 'recompose'
import * as Container from '../util/container'
import {requestIdleCallback} from '../util/idle-callback'
import {RouteProps} from '../route-tree/render-route'

type OwnProps = {
  routeSelected: Types.Tab
  children: React.ReactNode
} & RouteProps

const mapStateToProps = (state: Container.TypedState) => ({
  _badgeNumbers: state.notifications.navBadges,
  _contactImportEnabled: state.settings.contacts.importEnabled,
  _walletsAcceptedDisclaimer: state.wallets.acceptedDisclaimer,
  badgeNotifications: !state.push.hasPermissions,
  hasRandomPW: state.settings.password.randomPW,
  isModal: false,
  logoutHandshakeWaiters: state.config.logoutHandshakeWaiters,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  _loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
  onLogout: () => dispatch(ConfigGen.createLogout()),
  onTabChange: (tab: Types.Tab, walletsAcceptedDisclaimer: boolean) => {
    if (tab === Constants.walletsTab && !walletsAcceptedDisclaimer) {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
      return
    }
    if (ownProps.routeSelected === Constants.accountTab && tab !== Constants.accountTab) {
      dispatch(SettingsGen.createClearAddedEmail())
    }
    dispatch(RouteTreeGen.createNavigateAppend({path: [tab]}))
  },
})

const mergeProps = (stateProps: ReturnType<typeof mapStateToProps>, dispatchProps, ownProps) => ({
  _loadHasRandomPW: dispatchProps._loadHasRandomPW,
  badgeNotifications: stateProps.badgeNotifications,
  badgeNumbers: stateProps._badgeNumbers.toObject(),
  children: ownProps.children,
  contactsLabel: stateProps._contactImportEnabled ? 'Phone contacts' : 'Import phone contacts',
  hasRandomPW: stateProps.hasRandomPW,
  isModal: stateProps.isModal,
  logoutInProgress: stateProps.logoutHandshakeWaiters.size > 0,
  onLogout: dispatchProps.onLogout,
  onTabChange: tab => dispatchProps.onTabChange(tab, stateProps._walletsAcceptedDisclaimer),
  selectedTab: ownProps.routeSelected,
})

const Connected = compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.lifecycle({
    componentDidMount() {
      // @ts-ignore NO recompose
      const loadHasRandomPW = this.props._loadHasRandomPW
      requestIdleCallback(loadHasRandomPW)
    },
  })
)(SettingsContainer as any)

// @ts-ignore TODO fix
Connected.navigationOptions = {
  header: null,
}

export default Connected

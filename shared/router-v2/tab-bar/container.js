// @flow
import * as Tabs from '../../constants/tabs'
import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as PeopleGen from '../../actions/people-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TrackerConstants from '../../constants/tracker2'
import TabBar from '.'
import {connect} from '../../util/container'
import {memoize} from '../../util/memoize'
import {isLinux} from '../../constants/platform'
import openURL from '../../util/open-url'
import {quit, hideWindow} from '../../util/quit-helper'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as SettingsGen from '../../actions/settings-gen'

type OwnProps = {|
  selectedTab: Tabs.Tab,
|}

const mapStateToProps = state => ({
  _badgeNumbers: state.notifications.navBadges,
  fullname: TrackerConstants.getDetails(state, state.config.username).fullname || '',
  isWalletsNew: state.chat2.isWalletsNew,
  username: state.config.username,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onProfileClick: username => dispatch(ProfileGen.createShowUserProfile({username})),
  _onTabClick: tab => {
    if (ownProps.selectedTab === Tabs.peopleTab && tab !== Tabs.peopleTab) {
      dispatch(PeopleGen.createMarkViewed())
    }
    dispatch(RouteTreeGen.createNavigateAppend({path: [tab]}))
  },
  onHelp: () => openURL('https://keybase.io/docs'),
  onQuit: () => {
    if (!__DEV__) {
      if (isLinux) {
        dispatch(SettingsGen.createStop({exitCode: RPCTypes.ctlExitCode.ok}))
      } else {
        dispatch(ConfigGen.createDumpLogs({reason: 'quitting through menu'}))
      }
    }
    // In case dump log doesn't exit for us
    hideWindow()
    setTimeout(() => {
      quit('quitButton')
    }, 2000)
  },
  onSettings: () => dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.settingsTab]})),
  onSignOut: () => dispatch(ConfigGen.createLogout()),
})

const getBadges = memoize(b => b.toObject())

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumbers: getBadges(stateProps._badgeNumbers),
  fullname: stateProps.fullname,
  isWalletsNew: stateProps.isWalletsNew,
  onHelp: dispatchProps.onHelp,
  onProfileClick: () => dispatchProps._onProfileClick(stateProps.username),
  onQuit: dispatchProps.onQuit,
  onSettings: dispatchProps.onSettings,
  onSignOut: dispatchProps.onSignOut,
  onTabClick: (tab: Tabs.Tab) => dispatchProps._onTabClick(tab),
  selectedTab: ownProps.selectedTab,
  username: stateProps.username,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TabBar)

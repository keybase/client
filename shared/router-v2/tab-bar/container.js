// @flow
import * as Tabs from '../../constants/tabs'
import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TrackerConstants from '../../constants/tracker2'
import TabBar from '.'
import {connect} from '../../util/container'
import {memoize} from '../../util/memoize'
import openURL from '../../util/open-url'

type OwnProps = {|
  selectedTab: Tabs.Tab,
|}

const mapStateToProps = state => ({
  _badgeNumbers: state.notifications.navBadges,
  fullname: TrackerConstants.getDetails(state, state.config.username).fullname || '',
  isWalletsNew: state.chat2.isWalletsNew,
  username: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _onProfileClick: username => dispatch(ProfileGen.createShowUserProfile({username})),
  _onTabClick: tab => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [tab]}))
  },
  onHelp: () => openURL('https://keybase.io/docs'),
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

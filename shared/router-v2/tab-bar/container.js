// @flow
import * as Tabs from '../../constants/tabs'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import TabBar from '.'
import {connect} from '../../util/container'
import {memoize} from '../../util/memoize'

type OwnProps = {|
  selectedTab: Tabs.Tab,
|}

const mapStateToProps = state => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  isWalletsNew: state.chat2.isWalletsNew,
  username: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _onProfileClick: username => dispatch(ProfileGen.createShowUserProfile({username})),
  _onTabClick: tab => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [tab]}))
  },
})

const getBadges = memoize(b => b.toObject())

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumbers: getBadges(stateProps._badgeNumbers),
  isWalletsNew: stateProps.isWalletsNew,
  onProfileClick: () => dispatchProps._onProfileClick(stateProps.username),
  onTabClick: (tab: Tabs.Tab) => dispatchProps._onTabClick(tab),
  selectedTab: ownProps.selectedTab,
  username: stateProps.username,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TabBar)

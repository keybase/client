// @flow
import {connect} from '../../util/container'
import TabBar from '.'
import type {Tab} from '../../constants/tabs'
// import {createShowUserProfile} from '../../actions/profile-gen'

type OwnProps = {|
  selectedTab: Tab,
|}

const mapStateToProps = state => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  isWalletsNew: state.chat2.isWalletsNew,
  username: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _onTabClick: (_, __, ___) => {
    console.log('todo')
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumbers: stateProps._badgeNumbers.toObject(),
  isNew: {
    // [walletsTab]: stateProps.isWalletsNew,
  },
  onTabClick: (tab: Tab) => dispatchProps._onTabClick(tab, stateProps.username, stateProps.isWalletsNew),
  selectedTab: ownProps.selectedTab,
  username: stateProps.username,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TabBar)

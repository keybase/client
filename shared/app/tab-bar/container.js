// @flow
import {createSelector, connect, type TypedState} from '../../util/container'
import {usernameSelector} from '../../constants/selectors'
import TabBarRender from './index.render'

const getNavBadges = (state: TypedState) => state.notifications.get('navBadges')

const mapStateToProps = createSelector([getNavBadges, usernameSelector], (badgeNumbers, username) => {
  console.log('aaa mapst', badgeNumbers, username)
  return {
    badgeNumbers: badgeNumbers.toObject(),
    username,
  }
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  console.log('aaa merge', stateProps, ownProps)
  return {
    badgeNumbers: stateProps.badgeNumbers,
    onTabClick: ownProps.onTabClick,
    selectedTab: ownProps.selectedTab,
    username: stateProps.username || '',
  }
}

export default connect(mapStateToProps, null, mergeProps)(TabBarRender)

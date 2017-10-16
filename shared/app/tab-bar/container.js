// @flow
import {createSelector, connect, type TypedState} from '../../util/container'
import {usernameSelector} from '../../constants/selectors'
import TabBarRender from './index.render'

const getNavBadges = (state: TypedState) => state.notifications.get('navBadges')

const mapStateToProps = createSelector([getNavBadges, usernameSelector], (badgeNumbers, username) => ({
  badgeNumbers: badgeNumbers.toObject(),
  username,
}))

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumbers: stateProps.badgeNumbers,
  onTabClick: ownProps.onTabClick,
  selectedTab: ownProps.selectedTab,
  username: stateProps.username || '',
})

export default connect(mapStateToProps, null, mergeProps)(TabBarRender)

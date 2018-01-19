// @flow
import {createSelector, connect, type TypedState} from '../../util/container'
import {usernameSelector} from '../../constants/selectors'
import TabBarRender from './index.render'
import * as PushConstants from '../../constants/push'

const getNavBadges = (state: TypedState) => state.notifications.get('navBadges')
const getBadgePushNotifications = (state: TypedState) => PushConstants.showSettingsBadge(state)

const mapStateToProps = createSelector(
  [getNavBadges, usernameSelector, getBadgePushNotifications],
  (badgeNumbers, username, badgePushNotification) => ({
    badgeNumbers: badgeNumbers.toObject(),
    username,
    badgePushNotification,
  })
)

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumbers: stateProps.badgeNumbers,
  onTabClick: ownProps.onTabClick,
  selectedTab: ownProps.selectedTab,
  username: stateProps.username || '',
  badgePushNotification: stateProps.badgePushNotification,
})

export default connect(mapStateToProps, null, mergeProps)(TabBarRender)

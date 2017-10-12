// @flow
import {createSelector, connect, type TypedState} from '../../util/container'
import {usernameSelector} from '../../constants/selectors'
import TabBarRender from './index.render'

const getNavBadges = (state: TypedState) => state.notifications.get('navBadges')

const mapStateToProps = createSelector([getNavBadges, usernameSelector], (badgeNumbers, username) => ({
  badgeNumbers: badgeNumbers.toObject(),
  username,
}))

export default connect(mapStateToProps)(TabBarRender)

// @flow
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {usernameSelector} from '../../constants/selectors'
import TabBarRender from './index.render'
import type {TypedState} from '../../constants/reducer'

const getNavBadges = (state: TypedState) => state.notifications.get('navBadges')

const mapStateToProps = createSelector([getNavBadges, usernameSelector], (badgeNumbers, username) => ({
  badgeNumbers: badgeNumbers.toObject(),
  username,
}))

export default connect(mapStateToProps)(TabBarRender)

// @flow
import {connect} from 'react-redux-profiled'
import {createSelector} from 'reselect'
import {usernameSelector} from '../../constants/selectors'
import TabBarRender from './index.render'

const mapStateToProps = createSelector(
  [state => state.notifications.get('navBadges'), usernameSelector],
  (badgeNumbers, username) => ({badgeNumbers: badgeNumbers.toObject(), username})
)

export default connect(mapStateToProps)(TabBarRender)

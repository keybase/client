// @flow
import {connect} from 'react-redux'
import TabBarRender from './index.render'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({
  badgeNumbers: state.notifications.get('navBadges'),
  username: state.config.username,
})

export default connect(mapStateToProps)(TabBarRender)

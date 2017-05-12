// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Notifications from './index'
import {
  notificationsRefresh,
  notificationsSave,
  notificationsToggle,
} from '../../actions/settings'

import type {TypedState} from '../../constants/reducer'

class NotificationsContainer extends Component {
  componentWillMount() {
    this.props.onRefresh()
  }

  render() {
    return <Notifications {...this.props} />
  }
}

export default connect(
  (state: TypedState, ownProps: {}) => ({
    ...state.settings.notifications,
    waitingForResponse: state.settings.waitingForResponse,
  }),
  (dispatch: any, ownProps: {}) => ({
    onSave: () => dispatch(notificationsSave()),
    onToggle: (name: string) => dispatch(notificationsToggle(name)),
    onToggleUnsubscribeAll: () => dispatch(notificationsToggle()),
    onRefresh: () => dispatch(notificationsRefresh()),
  })
)(NotificationsContainer)

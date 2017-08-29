// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Notifications from './index'
import {navigateUp} from '../../actions/route-tree'
import {notificationsRefresh, notificationsToggle} from '../../actions/settings'

import type {TypedState} from '../../constants/reducer'

class NotificationsContainer extends Component<any> {
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
    onBack: () => dispatch(navigateUp()),
    onToggle: (group: string, name?: string) => dispatch(notificationsToggle(group, name)),
    onToggleUnsubscribeAll: (group: string) => dispatch(notificationsToggle(group)),
    onRefresh: () => dispatch(notificationsRefresh()),
    title: 'Notifications',
  })
)(NotificationsContainer)

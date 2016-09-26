// @flow
import React from 'react'
import {connect} from 'react-redux'
import Notifications from './index'

import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

const NotificationsContainer = (props: Props) => (
  <Notifications {...props} />
)

// TODO real integration
export default connect(
  (state: TypedState, ownProps: {}) => ({
    settings: [
      {
        name: 'follow',
        subscribed: true,
        description: 'when someone follows me',
      },
      {
        name: 'twitter_friend_joined',
        subscribed: true,
        description: 'when someone I follow on Twitter joins',
      },
      {
        name: 'filesystem_attention',
        subscribed: true,
        description: 'when the Keybase filesystem needs my attention',
      },
      {
        name: 'newsletter',
        subscribed: true,
        description: 'Keybase news, once in a great while',
      },
    ],
    unsubscribedFromAll: false,
    onSave: () => console.log('onSave'),
    onToggle: (name: string) => console.log('on toggle', name),
    onToggleUnsubscribeAll: () => console.log('on subscribe all'),
  }),
  (dispatch: any, ownProps: {}) => ({}),
)(NotificationsContainer)

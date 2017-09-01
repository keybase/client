// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import Notifications from './index'

const load = () => {
  storiesOf('Chat/Conversation/InfoPanelNotifications', module).add('Notifications', () => (
    <Notifications
      channelWide={false}
      desktop="desktop"
      mobile="mobile"
      onSetDesktop={action('onSetDesktop')}
      onSetMobile={action('onSetMobile')}
      onToggleChannelWide={action('onToggleChannelwide')}
    />
  ))
}

export default load

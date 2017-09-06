// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import Notifications from './index'

const load = () => {
  storiesOf('Chat/Conversation/InfoPanelNotifications', module)
    .add('Notifications (1)', () => (
      <Notifications
        channelWide={false}
        desktop="atmention"
        mobile="never"
        onSetDesktop={action('onSetDesktop')}
        onSetMobile={action('onSetMobile')}
        onToggleChannelWide={action('onToggleChannelwide')}
      />
    ))
    .add('Notifications (2)', () => (
      <Notifications
        channelWide={true}
        desktop="generic"
        mobile="atmention"
        onSetDesktop={action('onSetDesktop')}
        onSetMobile={action('onSetMobile')}
        onToggleChannelWide={action('onToggleChannelwide')}
      />
    ))
}

export default load

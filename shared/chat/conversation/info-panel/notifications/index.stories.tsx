import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import {Notifications} from './index'

const defaultProps = {
  channelWide: false,
  desktop: 'onWhenAtMentioned' as 'onWhenAtMentioned',
  mobile: 'never' as 'never',
  muted: false,
  saving: false,
  toggleChannelWide: action('onToggleChannelwide'),
  toggleMuted: action('toggleMuted'),
  updateDesktop: action('updateDesktop'),
  updateMobile: action('updateMobile'),
}

const load = () => {
  storiesOf('Chat/Conversation/InfoPanelNotifications', module)
    .add('Notifications', () => <Notifications {...defaultProps} />)
    .add('Notifications (muted)', () => <Notifications {...defaultProps} muted={true} />)
    .add('Notifications (saving)', () => (
      <Notifications
        {...defaultProps}
        channelWide={true}
        desktop="onAnyActivity"
        mobile="onWhenAtMentioned"
        saving={true}
      />
    ))
}

export default load

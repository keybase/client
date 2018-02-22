// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import {Notifications} from './index'

const common = {
  channelWide: false,
  desktop: 'onWhenAtMentioned',
  mobile: 'never',
  muted: false,
  toggleChannelWide: action('onToggleChannelwide'),
  toggleMuted: action('toggleMuted'),
  updateDesktop: action('updateDesktop'),
  updateMobile: action('updateMobile'),
}

const load = () => {
  storiesOf('Chat/Conversation/InfoPanelNotifications', module)
    .add('Notifications (unsaved)', () => <Notifications {...common} saveState="same" />)
    .add('Notifications (saving)', () => (
      <Notifications
        {...common}
        channelWide={true}
        desktop="onAnyActivity"
        mobile="onWhenAtMentioned"
        saveState="saving"
      />
    ))
    .add('Notifications (saved)', () => (
      <Notifications
        {...common}
        channelWide={true}
        desktop="onAnyActivity"
        mobile="onWhenAtMentioned"
        saveState="justSaved"
      />
    ))
}

export default load

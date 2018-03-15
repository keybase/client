// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import {Notifications} from './index'

const defaultProps = {
  channelWide: false,
  desktop: 'onWhenAtMentioned',
  mobile: 'never',
  muted: false,
  saveState: 'same',
  toggleChannelWide: action('onToggleChannelwide'),
  toggleMuted: action('toggleMuted'),
  updateDesktop: action('updateDesktop'),
  updateMobile: action('updateMobile'),
}

const load = () => {
  storiesOf('Chat/Conversation/InfoPanelNotifications', module)
    .add('Notifications (unsaved)', () => <Notifications {...defaultProps} saveState="same" />)
    .add('Notifications (muted)', () => <Notifications {...defaultProps} muted={true} />)
    .add('Notifications (saving)', () => (
      <Notifications
        {...defaultProps}
        channelWide={true}
        desktop="onAnyActivity"
        mobile="onWhenAtMentioned"
        saveState="saving"
      />
    ))
    .add('Notifications (saved)', () => (
      <Notifications
        {...defaultProps}
        channelWide={true}
        desktop="onAnyActivity"
        mobile="onWhenAtMentioned"
        saveState="justSaved"
      />
    ))
}

export default load

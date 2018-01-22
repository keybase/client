// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import Notifications from './index'

const load = () => {
  storiesOf('Chat/Conversation/InfoPanelNotifications', module)
    .add('Notifications (unsaved)', () => (
      <Notifications
        hasConversation={true}
        channelWide={false}
        desktop="atmention"
        mobile="never"
        muted={false}
        saveState="unsaved"
        onMuteConversation={action('onMuteConversation')}
        onSetDesktop={action('onSetDesktop')}
        onSetMobile={action('onSetMobile')}
        onToggleChannelWide={action('onToggleChannelwide')}
      />
    ))
    .add('Notifications (saving)', () => (
      <Notifications
        hasConversation={true}
        channelWide={true}
        desktop="generic"
        mobile="atmention"
        muted={false}
        saveState="saving"
        onMuteConversation={action('onMuteConversation')}
        onSetDesktop={action('onSetDesktop')}
        onSetMobile={action('onSetMobile')}
        onToggleChannelWide={action('onToggleChannelwide')}
      />
    ))
    .add('Notifications (saved)', () => (
      <Notifications
        hasConversation={true}
        channelWide={true}
        desktop="generic"
        mobile="atmention"
        muted={false}
        saveState="saved"
        onMuteConversation={action('onMuteConversation')}
        onSetDesktop={action('onSetDesktop')}
        onSetMobile={action('onSetMobile')}
        onToggleChannelWide={action('onToggleChannelwide')}
      />
    ))
}

export default load

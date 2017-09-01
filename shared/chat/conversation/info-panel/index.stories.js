// @flow
import React from 'react'
import {storiesOf, action} from '../../../stories/storybook'
import {MuteRow} from './index'

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module)
    .add('Mute row (small)', () => (
      <MuteRow label="Mute notifications" muted={false} onMute={action('onMute')} />
    ))
    .add('Mute row (small, muted)', () => (
      <MuteRow label="Mute notifications" muted={true} onMute={action('onMute')} />
    ))
    .add('Mute row (big)', () => <MuteRow label="Mute channel" muted={false} onMute={action('onMute')} />)
    .add('Mute row (big, muted)', () => (
      <MuteRow label="Mute channel" muted={true} onMute={action('onMute')} />
    ))
}

export default load

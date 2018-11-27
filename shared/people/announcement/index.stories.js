// @flow
import React from 'react'
import {storiesOf, action} from '../../stories/storybook'
import Announcement from '.'

const props = {
  appLink: null,
  badged: false,
  confirmLabel: null,
  onConfirm: () => action('onConfirm'),
  onDismiss: null,
  text: 'go to chat now',
  url: null,
}

const onDismiss = {
  onDismiss: () => action('onDismiss'),
}

const load = () => {
  storiesOf('People/Announcements', module)
    .add('Text only', () => <Announcement {...props} />)
    .add('Text only badged', () => <Announcement {...props} badged={true} />)
    .add('Text only confirm', () => <Announcement {...props} confirmLabel="Ok!" />)
    .add('Text only dismiss', () => <Announcement {...props} {...onDismiss} />)
    .add('Text only confirm/dismiss', () => <Announcement {...props} {...onDismiss} confirmLabel="Ok!" />)
    .add('Go to chat', () => <Announcement {...props} appLink="tab:Chat" />)
    .add('Go to chat confirm', () => <Announcement {...props} appLink="tab:Chat" confirmLabel="I did it" />)
    .add('Go to chat dismiss', () => <Announcement {...props} appLink="tab:Chat" {...onDismiss} />)
    .add('Go to chat confirm/dismiss', () => (
      <Announcement {...props} appLink="tab:Chat" {...onDismiss} confirmLabel="I did it" />
    ))
    .add('Go to web homepage', () => <Announcement {...props} url="https://keybase.io" />)
}

export default load

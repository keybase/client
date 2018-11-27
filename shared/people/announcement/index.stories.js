// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Announcement from './container'

const props = {
  appLink: null,
  badged: false,
  confirmLabel: null,
  dismissable: false,
  iconUrl: null,
  url: null,
}

const provider = Sb.createPropProviderWithCommon({
  Announcement: p => ({
    ...p,
    onConfirm: () => Sb.action('onConfirm'),
    onDismiss: () => Sb.action('onDismiss'),
  }),
})

const load = () => {
  Sb.storiesOf('People/Announcements', module)
    .addDecorator(provider)
    .add('Text only', () => <Announcement {...props} text="Text only" />)
    .add('Text only custom icon', () => (
      <Announcement
        {...props}
        text="Text only"
        iconUrl="https://keybase.io/images/blog/exploding/cherry_sm.png"
      />
    ))
    .add('Text only badged', () => <Announcement {...props} badged={true} text="Text only badged" />)
    .add('Text only confirm', () => <Announcement {...props} confirmLabel="Ok!" text="Text only confirm" />)
    .add('Text only dismiss', () => <Announcement {...props} text="Text only dismiss" />)
    .add('Text only confirm/dismiss', () => (
      <Announcement {...props} confirmLabel="Ok!" text="Text only confirm/dismiss" />
    ))
    .add('Go to chat', () => <Announcement {...props} appLink="tab:Chat" text="Go to chat" />)
    .add('Go to chat confirm', () => (
      <Announcement {...props} appLink="tab:Chat" confirmLabel="I did it" text="Go to chat confirm" />
    ))
    .add('Go to chat dismiss', () => <Announcement {...props} appLink="tab:Chat" text="Go to chat dismiss" />)
    .add('Go to chat confirm/dismiss', () => (
      <Announcement {...props} appLink="tab:Chat" confirmLabel="I did it" text="Go to chat confirm/dismiss" />
    ))
    .add('Go to web homepage', () => (
      <Announcement {...props} url="https://keybase.io" text="Go to web homepage" />
    ))
}

export default load

// @flow
import * as React from 'react'
import * as Storybook from '../stories/storybook'
import * as Kb from '../common-adapters'
import Menubar from './index.desktop'
import OutOfDate from './out-of-date'

const props = {
  badgeInfo: {
    'tabs:chatTab': 0,
    'tabs:folderTab': 0,
    'tabs:fsTab': 0,
    'tabs:gitTab': 0,
    'tabs:peopleTab': 0,
    'tabs:teamsTab': 0,
  },
  config: {
    avatars: {},
    followers: {},
    following: {},
  },
  folderProps: null,
  isAsyncWriteHappening: false,
  logIn: Storybook.action('logIn'),
  loggedIn: true,
  updateNow: Storybook.action('updateNow'),
  onFolderClick: Storybook.action('onFolderClick'),
  onRekey: Storybook.action('onRekey'),
  openApp: Storybook.action('openApp'),
  quit: Storybook.action('quit'),
  refresh: Storybook.action('refresh'),
  showBug: Storybook.action('showBug'),
  showHelp: Storybook.action('showHelp'),
  showUser: Storybook.action('showUser'),
  username: 'nathunsmitty',
  windowComponent: 'menubar',
  windowParam: '',
  onSelectConversation: () => {},
  conversations: [
    // TODO: fill in a few.
  ],
}

const providers = Storybook.createPropProviderWithCommon({
  ChatRow: () => ({
    convRows: [],
    onViewAll: () => {},
  }),
})

const load = () => {
  Storybook.storiesOf('Menubar', module)
    .addDecorator(providers)
    .add('Normal', () => <Menubar {...props} />)
    .add('Not logged in', () => <Menubar {...props} loggedIn={false} />)
    .add('With a file notification', () => (
      <Menubar
        {...props}
        badgeInfo={{
          ...props.badgeInfo,
          'tabs:fsTab': 2,
        }}
      />
    ))
    .add('With a people notification', () => (
      <Menubar
        {...props}
        badgeInfo={{
          ...props.badgeInfo,
          'tabs:peopleTab': 3,
        }}
      />
    ))
    .add('With a chat notification', () => (
      <Menubar
        {...props}
        badgeInfo={{
          ...props.badgeInfo,
          'tabs:chatTab': 6,
        }}
      />
    ))
    .add('Async write happening', () => <Menubar {...props} isAsyncWriteHappening={true} />)
    .add('Out of date banner', () => (
      <Kb.Box2 fullWidth={true} direction="vertical" gap="small">
        <OutOfDate outOfDate={true} critical={false} updateNow={Storybook.action('updateNow')} />
        <OutOfDate outOfDate={true} critical={true} updateNow={Storybook.action('updateNow')} />
      </Kb.Box2>
    ))
}

export default load

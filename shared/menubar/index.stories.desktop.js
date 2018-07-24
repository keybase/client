// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import Menubar from './index.desktop'

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
  logIn: action('logIn'),
  loggedIn: true,
  onFolderClick: action('onFolderClick'),
  onRekey: action('onRekey'),
  openApp: action('openApp'),
  quit: action('quit'),
  refresh: action('refresh'),
  showBug: action('showBug'),
  showHelp: action('showHelp'),
  showUser: action('showUser'),
  username: 'nathunsmitty',
  windowComponent: 'menubar',
  windowParam: '',
}

const load = () => {
  storiesOf('Menubar', module)
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
}

export default load

// @flow
import * as React from 'react'
import * as Storybook from '../stories/storybook'
import * as Kb from '../common-adapters'
import * as ConfigConstants from '../constants/config'
import Menubar from './index.desktop'
import OutOfDate from './out-of-date'
import {FileUpdate} from './files.desktop'

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
  conversations: [
    // TODO: fill in a few.
  ],
  fileName: null,
  files: 0,
  folderProps: null,
  logIn: Storybook.action('logIn'),
  loggedIn: true,
  onFolderClick: Storybook.action('onFolderClick'),
  onRekey: Storybook.action('onRekey'),
  onSelectConversation: () => {},
  openApp: Storybook.action('openApp'),
  quit: Storybook.action('quit'),
  refresh: Storybook.action('refresh'),
  showBug: Storybook.action('showBug'),
  showHelp: Storybook.action('showHelp'),
  showInFinder: Storybook.action('showInFinder'),
  showUser: Storybook.action('showUser'),
  totalSyncingBytes: 0,
  updateNow: Storybook.action('updateNow'),
  username: 'nathunsmitty',
  windowComponent: 'menubar',
  windowParam: '',
}

const providers = Storybook.createPropProviderWithCommon({
  ChatPreview: () => ({
    convRows: [],
    onViewAll: () => {},
  }),
  FilesPreview: () => ({
    loadTlfUpdates: () => Storybook.action('loadTlfUpdates'),
    userTlfUpdates: [],
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
    .add('Out of date banner', () => (
      <Kb.Box2 fullWidth={true} direction="vertical" gap="small">
        <OutOfDate
          outOfDate={ConfigConstants.makeOutOfDate({critical: false})}
          updateNow={Storybook.action('updateNow')}
        />
        <OutOfDate
          outOfDate={ConfigConstants.makeOutOfDate({critical: true})}
          updateNow={Storybook.action('updateNow')}
        />
        <OutOfDate
          outOfDate={ConfigConstants.makeOutOfDate({critical: true, message: 'This is a critical message.'})}
          updateNow={Storybook.action('updateNow')}
        />
      </Kb.Box2>
    ))
    .add('Uploading', () => <Menubar {...props} files={1} totalSyncingBytes={1} />)
    .add('FileUpdate', () => (
      <Kb.Box2 direction="vertical">
        <FileUpdate name="foo" tlfType="private" onClick={Storybook.action('onClick')} uploading={false} />
        <FileUpdate name="bar" tlfType="private" onClick={Storybook.action('onClick')} uploading={true} />
        <FileUpdate name="cow" tlfType="private" onClick={Storybook.action('onClick')} uploading={true} />
        <FileUpdate name="poo" tlfType="private" onClick={Storybook.action('onClick')} uploading={false} />
      </Kb.Box2>
    ))
}

export default load

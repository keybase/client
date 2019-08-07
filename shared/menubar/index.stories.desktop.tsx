import * as React from 'react'
import * as Storybook from '../stories/storybook'
import * as Kb from '../common-adapters'
import * as ConfigConstants from '../constants/config'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import Menubar from './index.desktop'
import OutOfDate from './out-of-date'
import {FileUpdate} from './files.desktop'
import SpaceWarning from './space-warning'

const props = {
  badgeInfo: {
    'tabs.chatTab': 0,
    'tabs.folderTab': 0,
    'tabs.fsTab': 0,
    'tabs.gitTab': 0,
    'tabs.peopleTab': 0,
    'tabs.teamsTab': 0,
  },
  config: {
    avatars: {},
    followers: {},
    following: {},
  },
  conversations: [
    // TODO: fill in a few.
  ],
  daemonHandshakeState: 'done' as 'done',

  diskSpaceStatus: Types.DiskSpaceStatus.Ok,
  fileName: null,
  files: 0,
  folderProps: null,
  kbfsDaemonStatus: Constants.makeKbfsDaemonStatus({
    onlineStatus: Types.KbfsDaemonOnlineStatus.Online,
    rpcStatus: Types.KbfsDaemonRpcStatus.Connected,
  }),
  kbfsEnabled: true,
  logIn: Storybook.action('logIn'),
  loggedIn: true,
  onFolderClick: Storybook.action('onFolderClick'),
  onHideDiskSpaceBanner: Storybook.action('hideDiskSpaceBanner'),
  onRekey: Storybook.action('onRekey'),
  onRetrySync: Storybook.action('onRetrySync'),
  onSelectConversation: () => {},
  openApp: Storybook.action('openApp'),
  quit: Storybook.action('quit'),
  refreshUserFileEdits: Storybook.action('refreshUserFileEdits'),
  showBug: Storybook.action('showBug'),
  showHelp: Storybook.action('showHelp'),
  showInFinder: Storybook.action('showInFinder'),
  showUser: Storybook.action('showUser'),
  showingDiskSpaceBanner: true,
  totalSyncingBytes: 0,
  updateNow: Storybook.action('updateNow'),
  username: 'nathunsmitty',
  waitForKbfsDaemon: Storybook.action('waitForKbfsDaemon'),
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
    .add('Starting up', () => <Menubar {...props} daemonHandshakeState={'starting'} />)
    .add('Waiting on bootstrap', () => <Menubar {...props} daemonHandshakeState={'waitingForWaiters'} />)
    .add('Not logged in', () => <Menubar {...props} loggedIn={false} />)
    .add('With a file notification', () => (
      <Menubar
        {...props}
        badgeInfo={{
          ...props.badgeInfo,
          'tabs.fsTab': 2,
        }}
      />
    ))
    .add('With a people notification', () => (
      <Menubar
        {...props}
        badgeInfo={{
          ...props.badgeInfo,
          'tabs.peopleTab': 3,
        }}
      />
    ))
    .add('With a chat notification', () => (
      <Menubar
        {...props}
        badgeInfo={{
          ...props.badgeInfo,
          'tabs.chatTab': 6,
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
    .add('Out of space banner', () => (
      <Kb.Box2 fullWidth={true} direction="vertical" gap="small">
        <SpaceWarning
          diskSpaceStatus={Types.DiskSpaceStatus.Warning}
          onRetry={Storybook.action('retry')}
          hidden={false}
          onClose={Storybook.action('hide')}
        />
        <SpaceWarning
          diskSpaceStatus={Types.DiskSpaceStatus.Error}
          onRetry={Storybook.action('retry')}
          hidden={false}
          onClose={() => {}}
        />
      </Kb.Box2>
    ))
    .add('Uploading', () => <Menubar {...props} files={1} totalSyncingBytes={1} />)
    .add('FileUpdate', () => (
      <Kb.Box2 direction="vertical">
        <FileUpdate
          path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={false}
        />
        <FileUpdate
          path={Types.stringToPath('/keybase/team/kbkbfstest/bar')}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={true}
        />
        <FileUpdate
          path={Types.stringToPath('/keybase/team/kbkbfstest/cow')}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={true}
        />
        <FileUpdate
          path={Types.stringToPath('/keybase/team/kbkbfstest/poo')}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={false}
        />
        <FileUpdate
          path={Types.stringToPath(
            '/keybase/team/kbkbfstest/poo-long-name-long-name-long-name long-name-long-name-long-name-long-name long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name'
          )}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={false}
        />
        <FileUpdate
          path={Types.stringToPath(
            '/keybase/team/kbkbfstest/moo_c_windows_system32_drivers_etc_hosts_long_name_long_name_long_name_long_name_long_name_long_name_long_name_long_name_long_name_long_name_long_name_long_name'
          )}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={false}
        />
        <FileUpdate
          path={Types.stringToPath(
            '/keybase/team/kbkbfstest/not-quite-so-long-really-not-quite-as-long-but-still-pretty-long-name.desktop.js'
          )}
          tlfType={Types.TlfType.Private}
          onClick={Storybook.action('onClick')}
          uploading={false}
        />
      </Kb.Box2>
    ))
}

export default load

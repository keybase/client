// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import * as Sb from '../stories/storybook'
import {type ConnectedProps as ConnectedUsernamesProps} from '../common-adapters/usernames'
import {globalColors, globalMargins} from '../styles'
import Files, {WrapRow} from '.'
import ConnectedStillRow from './row/still-container'
import TlfTypeRow from './row/tlf-type'
import TlfRow from './row/tlf'
import StillRow from './row/still'
import EditingRow from './row/editing'
import PlaceholderRow from './row/placeholder'
import UploadingRow from './row/uploading'
import {NormalPreview} from './filepreview'
import {Box, Box2, Text, OverlayParentHOC} from '../common-adapters'
import Downloads from './footer/downloads'
import Download from './footer/download'
import Upload from './footer/upload'
import PathItemAction from './common/path-item-action'
import Breadcrumb from './header/breadcrumb.desktop'
import Banner from './banner'
import Errs from './footer/errs'

const FloatingPathItemAction = OverlayParentHOC(PathItemAction)

const folderItemStyles = {
  iconSpec: {
    type: 'basic',
    iconType: 'icon-folder-private-32',
    iconColor: globalColors.darkBlue2,
  },
  textColor: globalColors.black_75,
  textType: 'BodySemibold',
}

const fileItemStyles = {
  iconSpec: {
    type: 'basic',
    iconType: 'icon-file-private-32',
    iconColor: globalColors.darkBlue2,
  },
  textColor: globalColors.black_75,
  textType: 'Body',
}

const rowProviders = {
  Row: ({path, routePath}) => ({
    pathItemType: 'folder',
    path,
    routePath,
  }),
  ConnectedStillRow: ({path}: {path: Types.Path}) => {
    const pathStr = Types.pathToString(path)
    return {
      name: Types.getPathName(path),
      type: 'folder',
      itemStyles: folderItemStyles,
      onAction: Sb.action('onAction'),
      isEmpty: pathStr.includes('empty'),
    }
  },
  ConnectedOpenHOC: ownProps => ({
    ...ownProps,
    onOpen: () => {},
  }),
  ConnectedOpenInFileUI: () => ({
    kbfsEnabled: false,
    openInFileUI: Sb.action('openInFileUI'),
    installFuse: Sb.action('installFuse'),
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...rowProviders,
  ConnectedErrs: () => ({
    errs: [],
  }),
  ConnectedDownloads: () => ({
    downloadKeys: ['file 1', 'blah 2', 'yo 3'],
    thereAreMore: true,
    openDownloadFolder: Sb.action('openDownloadFolder'),
  }),
  ConnectedUpload: () => ({
    files: 0,
  }),
  ConnectedDownload: ({downloadKey}) => ({
    filename: downloadKey,
    completePortion: downloadKey.split('').reduce((num, char) => (num + char.charCodeAt(0)) % 100, 0) / 100,
    progressText: '42 s',
    isDone: false,
    open: Sb.action('open'),
    dismiss: Sb.action('dismiss'),
    cancel: Sb.action('cancel'),
  }),
  FolderHeader: () => ({
    breadcrumbItems: [
      {
        name: 'keybase',
        path: '/keybase',
      },
    ],
    dropdownItems: [],
    isTeamPath: false,
    path: Types.stringToPath('/keybase'),
    onBack: Sb.action('onBack'),
    onOpenBreadcrumb: Sb.action('onOpenBreadcrumb'),
    onOpenBreadcrumbDropdown: Sb.action('onOpenBreadcrumbDropdown'),
  }),
  ConnectedBreadcrumb: () => ({
    dropdownItems: undefined,
    shownItems: [],
  }),
  SortBar: ({path}: {path: Types.Path}) => ({
    sortSetting: {
      sortBy: 'name',
      sortOrder: 'asc',
    },
    folderIsPending: true,
    sortSettingToAction: sortSetting => Sb.action(`sortSettingToAction${sortSetting}`),
  }),
  FilesBanner: () => ({
    path: Types.stringToPath('/keybase'),
    kbfsEnabled: true,
    showBanner: false,
    inProgress: false,
    showSecurityPrefs: false,
    getFuseStatus: Sb.action('getFuseStatus'),
    onDismiss: Sb.action('onDismiss'),
    onInstall: Sb.action('onInstall'),
    onUninstall: Sb.action('onUninstall'),
  }),
  FilePreviewDefaultView: () => ({
    fileUIEnabled: false,
    pathItem: Constants.makeFile({
      name: 'bar.jpg',
      size: 10240,
      lastWriter: {uid: '', username: 'foo'},
    }),
    itemStyles: Constants.getItemStyles(['keybase', 'private', 'foo', 'bar.jpg'], 'file', 'foo'),
    onDownload: () => {},
    onShowInFileUI: () => {},
    onShare: () => {},
    onSave: () => {},
  }),
  FilePreviewHeader: () => ({
    pathItem: Constants.makeFile({
      name: 'bar.jpg',
      size: 10240,
      lastWriter: {uid: '', username: 'foo'},
    }),
    onAction: () => {},
    onBack: () => {},
    onShowInFileUI: () => {},
    loadFilePreview: () => {},
    path: '/keybase/private/foo/bar.jpg',
  }),
  ViewContainer: () => ({
    url: '/keybase/private/foo/bar.jpg',
    mimeType: 'jpg',
    isSymlink: false,
    path: '/keybase/private/foo/bar.jpg',
    onInvalidToken: Sb.action('onInvalidToken'),
    loadMimeType: Sb.action('loadMimeType'),
  }),
  ResetBanner: ({path}: {path: Types.Path}) => ({
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    resetParticipants: ['reset1', 'reset2', 'reset3'],
    onReAddToTeam: () => () => undefined,
    onViewProfile: () => () => undefined,
  }),
  Banner: ({path}: {path: Types.Path}) => ({
    path,
    shouldShowReset: Types.pathToString(path).includes('reset'),
  }),
  Usernames: (props: ConnectedUsernamesProps) => ({
    ...props,
    users: props.usernames.map(u => ({username: u})),
  }),
  ConnectedAddNew: () => ({
    pathElements: [],
    style: {},
    menuItems: [],
  }),
  ConnectedPathItemAction: () => pathItemActionPopupProps(Types.stringToPath('/keybase/private/meatball')),
})

const downloadCommonActions = {
  open: Sb.action('open'),
  dismiss: Sb.action('dismiss'),
  cancel: Sb.action('cancel'),
}

const pathItemActionPopupProps = (path: Types.Path) => {
  const pathElements = Types.getPathElements(path)
  return {
    size: 0,
    type: 'folder',
    lastModifiedTimestamp: 0,
    lastWriter: 'meatball',
    childrenFolders: 0,
    childrenFiles: 0,
    itemStyles: Constants.getItemStyles(pathElements, 'folder', 'meatball'),
    name: Types.getPathNameFromElems(pathElements),
    path,
    pathElements,
    menuItems: [
      {
        title: 'menu item',
        onClick: Sb.action('onClick'),
      },
    ],
    onHidden: Sb.action('onHidden'),
  }
}

const breadcrumbProps = (names: Array<string>) => {
  const items = names.map((name, idx) => ({
    isTeamTlf: idx === 2 && names[idx - 1] === 'team',
    isLastItem: idx === names.length - 1,
    name: name,
    path: Types.stringToPath('/' + names.slice(0, idx + 1).join('/')),
    iconSpec: Constants.getItemStyles(names.slice(0, idx + 1), 'folder', 'foo').iconSpec,
    onClick: Sb.action('onClick'),
  }))
  return items.length > 3
    ? {
        dropdownItems: items.slice(0, items.length - 2),
        shownItems: items.slice(items.length - 2),
      }
    : {
        dropdownItems: undefined,
        shownItems: items,
      }
}

const commonRowProps = {
  onSubmit: Sb.action('onSubmit'),
  onUpdate: Sb.action('onUpdate'),
  onCancel: Sb.action('onCancel'),
}

const load = () => {
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        progress="loaded"
        routePath={I.List([])}
        isUserReset={false}
        resetParticipants={['foo']}
        items={[
          {rowType: 'still', path: Types.stringToPath('/keybase/private'), name: 'private'},
          {rowType: 'still', path: Types.stringToPath('/keybase/public'), name: 'public'},
          {rowType: 'still', path: Types.stringToPath('/keybase/team'), name: 'team'},
        ]}
        editingItems={[]}
      />
    ))
    .add('Preview', () => (
      <NormalPreview
        routePath={I.List([])}
        routeProps={I.Map({
          path: '/keybase/private/foo/bar.jpg',
        })}
      />
    ))
    .add('Rows', () => (
      <Box>
        <WrapRow key="1">
          <ConnectedStillRow
            name="a"
            path={Types.stringToPath('/keybase/private/a')}
            routeProps={I.Map({path: '/keybase/private/a'})}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="2">
          <EditingRow
            name="New Folder (editing)"
            hint="New Folder (editing)"
            status="editing"
            itemStyles={folderItemStyles}
            isCreate={true}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="3">
          <EditingRow
            name="From Dropbox (rename) (editing)"
            hint="From Dropbox (rename) (editing)"
            status="editing"
            itemStyles={folderItemStyles}
            isCreate={false}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="4">
          <EditingRow
            name="New Folder (saving)"
            hint="New Folder (saving)"
            status="saving"
            itemStyles={folderItemStyles}
            isCreate={true}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="5">
          <EditingRow
            name="New Folder (failed)"
            hint="New Folder (failed)"
            status="failed"
            itemStyles={folderItemStyles}
            isCreate={true}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="6">
          <UploadingRow
            name="foo"
            itemStyles={folderItemStyles}
            writingToJournal={true}
            syncing={false}
            error={false}
          />
        </WrapRow>
        <WrapRow key="7">
          <UploadingRow
            name="foo"
            itemStyles={fileItemStyles}
            writingToJournal={true}
            syncing={false}
            error={false}
          />
        </WrapRow>
        <WrapRow key="8">
          <UploadingRow
            name="foo"
            itemStyles={fileItemStyles}
            writingToJournal={true}
            syncing={true}
            error={false}
          />
        </WrapRow>
        <WrapRow key="9">
          <UploadingRow
            name="foo"
            itemStyles={fileItemStyles}
            writingToJournal={false}
            syncing={true}
            error={false}
          />
        </WrapRow>
        <WrapRow key="10">
          <UploadingRow
            name="foo"
            itemStyles={fileItemStyles}
            writingToJournal={false}
            syncing={false}
            error={false}
          />
        </WrapRow>
        <WrapRow key="11">
          <UploadingRow
            name="foo"
            itemStyles={fileItemStyles}
            writingToJournal={false}
            syncing={false}
            error={true}
          />
        </WrapRow>
        <WrapRow key="12">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            lastModifiedTimestamp={Date.now()}
            lastWriter="alice"
            itemStyles={fileItemStyles}
            isDownloading={true}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
          />
        </WrapRow>
        <WrapRow key="13">
          <PlaceholderRow type="folder" />
        </WrapRow>
        <WrapRow key="14">
          <PlaceholderRow type="file" />
        </WrapRow>
        <WrapRow key="15">
          <ConnectedStillRow
            name="empty"
            path={Types.stringToPath('/keybase/private/empty')}
            routeProps={I.Map({path: '/keybase/private/empty'})}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="16">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar/baz')}
            name="qux"
            type="file"
            lastModifiedTimestamp={Date.now()}
            lastWriter="bob"
            itemStyles={fileItemStyles}
            isDownloading={false}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
          />
        </WrapRow>
        <WrapRow key="17">
          <TlfTypeRow
            name="private"
            path={Types.stringToPath('/keybase/private')}
            itemStyles={folderItemStyles}
            badgeCount={0}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
          />
        </WrapRow>
        <WrapRow key="18">
          <TlfTypeRow
            name="private"
            path={Types.stringToPath('/keybase/private')}
            itemStyles={folderItemStyles}
            badgeCount={3}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
          />
        </WrapRow>
        <WrapRow key="19">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            itemStyles={folderItemStyles}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            isUserReset={false}
            resetParticipants={[]}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
          />
        </WrapRow>
        <WrapRow key="20">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            itemStyles={folderItemStyles}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            isUserReset={true}
            resetParticipants={['charlie']}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
          />
        </WrapRow>
        <WrapRow key="21">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            itemStyles={folderItemStyles}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            isUserReset={false}
            resetParticipants={['alice', 'bob']}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
          />
        </WrapRow>
        <WrapRow key="22">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            itemStyles={folderItemStyles}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            isUserReset={false}
            resetParticipants={[]}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
          />
        </WrapRow>
      </Box>
    ))
    .add('Downloads', () => (
      <Box2 direction="vertical">
        <Text type="Header">1 item</Text>
        <Downloads
          downloadKeys={['file 1']}
          thereAreMore={false}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
        <Text type="Header">2 items</Text>
        <Downloads
          downloadKeys={['file 1', 'blah 2']}
          thereAreMore={false}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
        <Text type="Header">3 items</Text>
        <Downloads
          downloadKeys={['file 1', 'blah 2', 'yo 3']}
          thereAreMore={false}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
        <Text type="Header">4+ items</Text>
        <Downloads
          downloadKeys={['file 1', 'blah 2', 'yo 3']}
          thereAreMore={true}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
      </Box2>
    ))
    .add('Download Cards', () => (
      <Box>
        <Box style={{height: 8}} />
        <Download
          filename="fjweio"
          completePortion={0.42}
          progressText="4 s"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweio afiojwe fweiojf oweijfweoi fjwoeifj ewoijf oew"
          completePortion={0.42}
          progressText="4 s"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweioafiojwefweiojfoweijfweoifjwoeifjewoijfoew"
          completePortion={0.42}
          progressText="4 s"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweioafiojwefweiojfoweijfweoifjwoeifjewoijfoew"
          completePortion={0.42}
          progressText="59 min"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweioafiojwefweiojfoweijfweoifjwoeifjewoijfoew"
          completePortion={0.42}
          progressText="1234 hr"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
      </Box>
    ))
    .add('PathItemAction', () => (
      <Box style={{padding: globalMargins.small}}>
        <FloatingPathItemAction
          {...pathItemActionPopupProps(Types.stringToPath('/keybase/private/meatball/folder/treat'))}
        />
        <FloatingPathItemAction
          {...pathItemActionPopupProps(
            Types.stringToPath(
              '/keybase/private/meatball/treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat'
            )
          )}
        />
        <FloatingPathItemAction
          {...pathItemActionPopupProps(
            Types.stringToPath(
              '/keybaes/private/meatball/foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar'
            )
          )}
        />
      </Box>
    ))
    .add('Breadcrumbs', () => (
      <Box>
        <Breadcrumb {...breadcrumbProps(['keybase', 'private', 'foo', 'bar'])} />
        <Breadcrumb {...breadcrumbProps(['keybase', 'private', 'foo'])} />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
          ])}
        />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
          ])}
        />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
            'haha',
          ])}
        />
        <Breadcrumb
          {...breadcrumbProps([
            'keybase',
            'private',
            'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
            'haha',
          ])}
        />
      </Box>
    ))
    .add('UploadBanner', () => (
      <Upload fileName={null} files={42} totalSyncingBytes={100} timeLeft="23 min" showing={true} />
    ))
    .add('ResetRows', () => (
      <Files
        path={Types.stringToPath('/keybase')}
        progress="loaded"
        routePath={I.List([])}
        isUserReset={false}
        resetParticipants={[]}
        items={[
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me'), name: 'me'},
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me,abc'), name: 'me,abc'},
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me,abc,def'), name: 'me,abc,def'},
          {
            rowType: 'still',
            path: Types.stringToPath('/keybase/private/me,abc,def,ghi'),
            name: 'me,abc,def,ghi',
          },
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me,def'), name: 'me,def'},
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me,def,ghi'), name: 'me,def,ghi'},
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me,ghi'), name: 'me,ghi'},
          {rowType: 'still', path: Types.stringToPath('/keybase/private/me,abc,ghi'), name: 'me,abc,ghi'},
        ]}
        editingItems={[]}
      />
    ))
    .add('ResetBanner', () => (
      <Box>
        <Banner
          path={Types.stringToPath('/keybase/private/me,reset1,reset2,reset3')}
          shouldShowReset={true}
        />
        <Box style={{height: 8}} />
        <Banner path={Types.stringToPath('/keybase/private/me,reset')} shouldShowReset={true} />
      </Box>
    ))
    .add('Errs', () => (
      <Errs
        errs={[
          {
            key: '1',
            time: 1534362428795,
            error: 'long error detail blah blah SimpleFS.SimpleFSCopyRecursive has blown up',
            msg: 'Error when downloading file blah 1.jpg',
            dismiss: Sb.action('dismiss'),
          },
          {
            key: '2',
            time: 1534362428795,
            error: 'long error detail blah blah SimpleFS.SimpleFSCopyRecursive has blown up',
            msg: 'Error when downloading file blah 2.jpg',
            retry: Sb.action('retry'),
            dismiss: Sb.action('dismiss'),
          },
          {
            key: '3',
            time: 1534362428795,
            error: 'long error detail blah blah SimpleFS.SimpleFSCopyRecursive has blown up',
            msg: 'Error when downloading file blah 99.jpg',
            retry: Sb.action('retry'),
            dismiss: Sb.action('dismiss'),
          },
        ]}
        more={2}
      />
    ))
}

export default load

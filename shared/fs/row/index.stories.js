// @flow
import * as I from 'immutable'
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Box} from '../../common-adapters'
import {WrapRow} from './rows'
import ConnectedStillRow from './still-container'
import TlfTypeRow from './tlf-type'
import TlfRow from './tlf'
import StillRow from './still'
import EditingRow from './editing'
import PlaceholderRow from './placeholder'
import UploadingRow from './uploading'
import {commonProvider} from '../common/index.stories'

export const rowsProvider = {
  ConnectedFilesLoadingHoc: (o: any) => ({
    ...o,
    loadFavorites: Sb.action('loadFavorites'),
    loadFolderList: Sb.action('loadFolderList'),
    path: '',
    syncingPaths: Sb.action('syncingPaths'),
  }),
  ConnectedOpenHOC: (ownProps: any) => ({
    ...ownProps,
    onOpen: Sb.action('onOpen'),
  }),
  ConnectedOpenInSystemFileManager: () => ({
    installFuse: Sb.action('installFuse'),
    kbfsEnabled: false,
    openInSystemFileManager: Sb.action('openInSystemFileManager'),
  }),
  ConnectedRows: (o: any) => ({
    destinationPickerIndex: o.destinationPickerIndex,
    ifEmpty: o.ifEmpty,
    items: [
      {name: 'me', path: Types.stringToPath('/keybase/private/me'), rowType: 'still'},
      {name: 'me,abc', path: Types.stringToPath('/keybase/private/me,empty'), rowType: 'still'},
      {name: 'me,abc,def', path: Types.stringToPath('/keybase/private/me,abc,def'), rowType: 'still'},
      {
        name: 'me,abc,def,ghi',
        path: Types.stringToPath('/keybase/private/me,abc,def,ghi'),
        rowType: 'still',
      },
      {name: 'me,def', path: Types.stringToPath('/keybase/private/me,def'), rowType: 'still'},
      {name: 'me,def,ghi', path: Types.stringToPath('/keybase/private/me,def,ghi'), rowType: 'still'},
      {name: 'me,ghi', path: Types.stringToPath('/keybase/private/me,ghi'), rowType: 'still'},
      {name: 'me,abc,ghi', path: Types.stringToPath('/keybase/private/me,abc,ghi'), rowType: 'still'},
    ],
    routePath: I.List(),
  }),
  ConnectedStillRow: ({
    path,
    destinationPickerIndex,
  }: {
    path: Types.Path,
    destinationPickerIndex?: number,
  }) => {
    const pathStr = Types.pathToString(path)
    return {
      destinationPickerIndex,
      isEmpty: pathStr.includes('empty'),
      itemStyles: folderItemStyles,
      name: Types.getPathName(path),
      type: 'folder',
    }
  },
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...rowsProvider,
})

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
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
        <WrapRow key="download-normal">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            lastModifiedTimestamp={Date.now()}
            lastWriter="alice"
            itemStyles={fileItemStyles}
            intentIfDownloading="none"
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
          />
        </WrapRow>
        <WrapRow key="download-save">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            lastModifiedTimestamp={Date.now()}
            lastWriter="alice"
            itemStyles={fileItemStyles}
            intentIfDownloading="camera-roll"
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
          />
        </WrapRow>
        <WrapRow key="download-share">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            lastModifiedTimestamp={Date.now()}
            lastWriter="alice"
            itemStyles={fileItemStyles}
            intentIfDownloading="share"
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

const folderItemStyles = {
  iconSpec: {
    iconColor: Styles.globalColors.darkBlue2,
    iconType: 'icon-folder-private-32',
    type: 'basic',
  },
  textColor: Styles.globalColors.black_75,
  textType: 'BodySemibold',
}

const fileItemStyles = {
  iconSpec: {
    iconColor: Styles.globalColors.darkBlue2,
    iconType: 'icon-file-private-32',
    type: 'basic',
  },
  textColor: Styles.globalColors.black_75,
  textType: 'Body',
}

const commonRowProps = {
  onCancel: Sb.action('onCancel'),
  onSubmit: Sb.action('onSubmit'),
  onUpdate: Sb.action('onUpdate'),
}

export default load

// @flow
import * as I from 'immutable'
import React from 'react'
import * as Sb from '../../stories/storybook'
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
      name: Types.getPathName(path),
      type: 'folder',
    }
  },
  LoadFilesWhenNeeded: ({path}: any) => ({
    loadFavorites: Sb.action('loadFavorites'),
    loadFolderList: Sb.action('loadFolderList'),
    path,
  }),
  SortBar: ({path}: {path: Types.Path}) => ({
    folderIsPending: true,
    sortSetting: {
      sortBy: 'name',
      sortOrder: 'asc',
    },
    sortSettingToAction: Sb.action('sortSettingToAction'),
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...rowsProvider,
})

const makeEditingRowNameProps = (name: string) => ({
  hint: name,
  name,
  projectedPath: Types.stringToPath(`/keybase/team/kbkbfstest/${name}`),
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
            {...makeEditingRowNameProps('New Folder (editing)')}
            status="editing"
            isCreate={true}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="3">
          <EditingRow
            {...makeEditingRowNameProps('From Dropbox (rename) (editing)')}
            status="editing"
            isCreate={false}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="4">
          <EditingRow
            {...makeEditingRowNameProps('New Folder (saving)')}
            status="saving"
            isCreate={true}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="5">
          <EditingRow
            {...makeEditingRowNameProps('New Folder (failed)')}
            status="failed"
            isCreate={true}
            {...commonRowProps}
          />
        </WrapRow>
        <WrapRow key="6">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
            type="folder"
            name="foo"
            writingToJournal={true}
            syncing={false}
          />
        </WrapRow>
        <WrapRow key="7">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
            type="file"
            name="foo"
            writingToJournal={true}
            syncing={false}
          />
        </WrapRow>
        <WrapRow key="8">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
            type="file"
            name="foo"
            writingToJournal={true}
            syncing={true}
          />
        </WrapRow>
        <WrapRow key="9">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
            type="file"
            name="foo"
            writingToJournal={false}
            syncing={true}
          />
        </WrapRow>
        <WrapRow key="10">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
            type="file"
            name="foo"
            writingToJournal={false}
            syncing={false}
          />
        </WrapRow>
        <WrapRow key="11">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
            type="file"
            name="foo"
            writingToJournal={false}
            syncing={false}
            errorRetry={Sb.action('errorRetry')}
          />
        </WrapRow>
        <WrapRow key="download-normal">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            intentIfDownloading="none"
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="download-save">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            intentIfDownloading="camera-roll"
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="download-share">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/bar')}
            name="bar"
            type="file"
            intentIfDownloading="share"
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
            routePath={I.List([])}
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
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            isEmpty={false}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="17">
          <TlfTypeRow
            name="private"
            path={Types.stringToPath('/keybase/private')}
            badgeCount={0}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="18">
          <TlfTypeRow
            name="private"
            path={Types.stringToPath('/keybase/private')}
            badgeCount={3}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="19">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="20">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            routePath={I.List([])}
          />
        </WrapRow>
        <WrapRow key="21">
          <TlfRow
            name="alice,bob,charlie"
            path={Types.stringToPath('/keybase/private/alice,bob,charlie')}
            needsRekey={false}
            isIgnored={false}
            isNew={true}
            onOpen={Sb.action('onOpen')}
            onAction={Sb.action('onAction')}
            routePath={I.List([])}
          />
        </WrapRow>
      </Box>
    ))

const commonRowProps = {
  onCancel: Sb.action('onCancel'),
  onSubmit: Sb.action('onSubmit'),
  onUpdate: Sb.action('onUpdate'),
}

export default load

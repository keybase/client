// @flow
import * as I from 'immutable'
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import {isMobile} from '../../constants/platform'
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
import {topBarProvider} from '../top-bar/index.stories'
import {asRows as topBarAsRow} from '../top-bar'

export const rowsProvider = {
  ConnectedOpenHOC: (ownProps: any) => ({
    ...ownProps,
    onOpen: Sb.action('onOpen'),
  }),
  ConnectedRows: (o: any) => ({
    destinationPickerIndex: o.destinationPickerIndex,
    items: I.List([
      ...(o.headerRows || []),
      ...topBarAsRow(o.path),
      {key: 'me', name: 'me', path: Types.stringToPath('/keybase/private/me'), rowType: 'still'},
      {
        key: 'me,abc',
        name: 'me,abc',
        path: Types.stringToPath('/keybase/private/me,empty'),
        rowType: 'still',
      },
      {
        key: 'me,abc,def',
        name: 'me,abc,def',
        path: Types.stringToPath('/keybase/private/me,abc,def'),
        rowType: 'still',
      },
      {
        key: 'me,abc,def,ghi',
        name: 'me,abc,def,ghi',
        path: Types.stringToPath('/keybase/private/me,abc,def,ghi'),
        rowType: 'still',
      },
      {key: 'me,def', name: 'me,def', path: Types.stringToPath('/keybase/private/me,def'), rowType: 'still'},
      {
        key: 'me,def,ghi',
        name: 'me,def,ghi',
        path: Types.stringToPath('/keybase/private/me,def,ghi'),
        rowType: 'still',
      },
      {key: 'me,ghi', name: 'me,ghi', path: Types.stringToPath('/keybase/private/me,ghi'), rowType: 'still'},
      {
        key: 'me,abc,ghi',
        name: 'me,abc,ghi',
        path: Types.stringToPath('/keybase/private/me,abc,ghi'),
        rowType: 'still',
      },
      {key: '1', name: '1', path: Types.stringToPath('/keybase/private/meatball/1'), rowType: 'still'},
      {key: '2', name: '2', path: Types.stringToPath('/keybase/private/meatball/2'), rowType: 'still'},
      {key: '3', name: '3', path: Types.stringToPath('/keybase/private/meatball/3'), rowType: 'still'},
      {key: '4', name: '4', path: Types.stringToPath('/keybase/private/meatball/4'), rowType: 'still'},
      {key: '5', name: '5', path: Types.stringToPath('/keybase/private/meatball/5'), rowType: 'still'},
      {key: '6', name: '6', path: Types.stringToPath('/keybase/private/meatball/dir/6'), rowType: 'still'},
      {key: '7', name: '7', path: Types.stringToPath('/keybase/private/meatball/dir/7'), rowType: 'still'},
      {key: '8', name: '8', path: Types.stringToPath('/keybase/private/meatball/dir/8'), rowType: 'still'},
      {key: '9', name: '9', path: Types.stringToPath('/keybase/private/meatball/dir/9'), rowType: 'still'},
      ...(!isMobile && typeof o.destinationPickerIndex === 'number'
        ? [{key: 'empty:0', rowType: 'empty'}, {key: 'empty:1', rowType: 'empty'}]
        : []),
    ]),
    routePath: I.List(),
  }),
  ConnectedStillRow: ({
    path,
    destinationPickerIndex,
  }: {
    destinationPickerIndex?: number,
    path: Types.Path,
    routePath: I.List<string>,
  }) => {
    const pathStr = Types.pathToString(path)
    return {
      destinationPickerIndex,
      isEmpty: pathStr.includes('empty'),
      name: Types.getPathName(path),
      path,
      routePath: I.List(),
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
  ...topBarProvider,
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
            path={Types.stringToPath('/keybase/private/meatball/a')}
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
            path={Types.stringToPath('/keybase/team/kbkbfstest/dir/foo')}
            type="file"
            name="foo"
            writingToJournal={true}
            syncing={false}
          />
        </WrapRow>
        <WrapRow key="8">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/dir/foo')}
            type="file"
            name="foo"
            writingToJournal={true}
            syncing={true}
          />
        </WrapRow>
        <WrapRow key="9">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/dir/foo')}
            type="file"
            name="foo"
            writingToJournal={false}
            syncing={true}
          />
        </WrapRow>
        <WrapRow key="10">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/dir/foo')}
            type="file"
            name="foo"
            writingToJournal={false}
            syncing={false}
          />
        </WrapRow>
        <WrapRow key="11">
          <UploadingRow
            path={Types.stringToPath('/keybase/team/kbkbfstest/dir/foo')}
            type="file"
            name="foo"
            writingToJournal={false}
            syncing={false}
            errorRetry={Sb.action('errorRetry')}
          />
        </WrapRow>
        <WrapRow key="download-normal">
          <StillRow
            path={Types.stringToPath('/keybase/private/foo/dir/bar')}
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
            path={Types.stringToPath('/keybase/private/foo/dir/bar')}
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
            path={Types.stringToPath('/keybase/private/foo/dir/bar')}
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
            path={Types.stringToPath('/keybase/private/meatball/empty')}
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

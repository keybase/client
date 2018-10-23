// @flow
import * as I from 'immutable'
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Box} from '../../common-adapters'
import {WrapRow} from '../'
import ConnectedStillRow from './still-container'
import TlfTypeRow from './tlf-type'
import TlfRow from './tlf'
import StillRow from './still'
import EditingRow from './editing'
import PlaceholderRow from './placeholder'
import UploadingRow from './uploading'
import {commonProvider} from '../common/index.stories'

export const rowsProvider = {
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
  ConnectedOpenHOC: (ownProps: any) => ({
    ...ownProps,
    onOpen: () => {},
  }),
  ConnectedOpenInSystemFileManager: () => ({
    kbfsEnabled: false,
    openInSystemFileManager: Sb.action('openInSystemFileManager'),
    installFuse: Sb.action('installFuse'),
  }),
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
    type: 'basic',
    iconType: 'icon-folder-private-32',
    iconColor: Styles.globalColors.darkBlue2,
  },
  textColor: Styles.globalColors.black_75,
  textType: 'BodySemibold',
}

const fileItemStyles = {
  iconSpec: {
    type: 'basic',
    iconType: 'icon-file-private-32',
    iconColor: Styles.globalColors.darkBlue2,
  },
  textColor: Styles.globalColors.black_75,
  textType: 'Body',
}

const commonRowProps = {
  onSubmit: Sb.action('onSubmit'),
  onUpdate: Sb.action('onUpdate'),
  onCancel: Sb.action('onCancel'),
}

export default load

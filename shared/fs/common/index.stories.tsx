import React from 'react'
import {isMobile} from '../../constants/platform'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import PathItemAction from './path-item-action'
import ItemIcon, {Size} from './item-icon'
import LastModifiedLine from './last-modified-line'
import KbfsPath from './kbfs-path'
import PathInfo from './path-info'
import PathItemInfo from './path-item-info'
import TlfInfoLine from './tlf-info-line'
import Errs from './errs'
import OpenInSystemFileManager from './open-in-system-file-manager'
import {OwnProps as LastModifiedLineOwnProps} from './last-modified-line-container'
import {OwnProps as TlfInfoLineOwnProps} from './tlf-info-line-container'
import PathStatusIcon from './path-status-icon'
import PieSlice from './pie-slice'
import ConfirmDelete from './path-item-action/confirm-delete'

const PathItemActionMenuHeaderProps = (props: any) => ({
  childrenFiles: 0,
  childrenFolders: 0,
  loadFolderList: Sb.action('loadFolderList'),
  loadPathMetadata: Sb.action('loadPathMetadata'),
  path: props.path,
  size: 0,
  type: Types.PathType.Folder,
})

const pathItemActionChooseViewProps = (props: any) => ({
  ...props,
  view: Types.PathItemActionMenuView.Root,
})

const PathItemActionMenuProps = (props: any) => ({
  ...props,
  copyPath: Sb.action('copyPath'),
  deleteFileOrFolder: Sb.action('deleteFileOrFolder'),
  download: Sb.action('download'),
  ignoreFolder: Sb.action('ignoreFolder'),
  onHidden: Sb.action('onHidden'),
  ...(isMobile
    ? {
        saveMedia: Sb.action('saveMedia'),
        shareNative: Sb.action('shareNative'),
      }
    : {}),
  showInSystemFileManager: Sb.action('showInSystemFileManager'),
})

export const commonProvider = {
  ConnectedErrs: () => ({
    errs: [],
  }),
  ConnectedOpenInSystemFileManager: () => ({
    driverEnabled: false,
    enableDriver: Sb.action('enableDriver'),
    openInSystemFileManager: Sb.action('openInSystemFileManager'),
  }),
  FolderViewFilter: (props: any) => ({
    onUpdate: Sb.action('onUpdate'),
    pathItem: Constants.emptyFolder,
    ...props,
  }),
  FolderViewFilterIcon: (props: any) => ({
    onUpdate: Sb.action('onUpdate'),
    pathItem: Constants.emptyFolder,
    ...props,
  }),
  LastModifiedLine: ({path, mode}: LastModifiedLineOwnProps) => ({
    lastModifiedTimestamp: Types.getPathElements(path).length > 3 ? 1545110765 : undefined,
    lastWriter: 'songgao_test',
    mode,
  }),
  LoadPathMetadataWhenNeeded: ({path}: {path: Types.Path}) => ({
    loadPathMetadataWithRefreshTag: Sb.action('loadPathMetadataWithRefreshTag'),
    loadPathMetadataWithoutRefreshTag: Sb.action('loadPathMetadataWithoutRefreshTag'),
    path,
    syncingFoldersProgress: Constants.emptySyncingFoldersProgress,
  }),
  NewFolder: ({path}: {path: Types.Path}) => ({
    canCreateNewFolder: Types.getPathLevel(path) > 2,
    onNewFolder: Sb.action('onNewFolder'),
  }),
  OfflineFolder: ({path}: {path: Types.Path}) => ({
    path,
    syncEnabled: false,
  }),
  OpenChat: ({path}: {path: Types.Path}) => ({
    onChat: Constants.canChat(path) ? Sb.action('onChat') : null,
  }),
  PathItemActionChooseView: pathItemActionChooseViewProps,
  PathItemActionMenu: PathItemActionMenuProps,
  PathItemActionMenuHeader: PathItemActionMenuHeaderProps,
  PathStatusIcon: () => ({
    isFolder: false,
    statusIcon: 'online-only',
  }),
  RefreshDriverStatusOnMount: () => ({
    refresh: Sb.action('refresh'),
  }),
  RefreshSettings: () => ({
    refresh: Sb.action('refresh'),
  }),
  SyncingFolders: () => ({
    progress: 0.67,
    show: true,
  }),
  TlfInfoLine: ({mixedMode, mode}: TlfInfoLineOwnProps) => ({
    mixedMode,
    mode,
    reset: ['foo', 'bar', 'cue'],
    tlfMtime: 1564784024580,
    tlfType: Types.TlfType.Private,
  }),
  TryEnableDriverOnFocus: () => ({
    appFocusedCount: 1,
    driverStatus: Constants.emptyDriverStatusEnabled,
    onEnabled: Sb.action('onEnabled'),
    refreshDriverStatus: Sb.action('refreshDriverStatus'),
  }),
  UploadButton: ({path, style}: {path: Types.Path; style?: Styles.StylesCrossPlatform | null}) => ({
    canUpload: Types.getPathLevel(path) > 2,
    openAndUploadBoth: Styles.isMobile ? null : Sb.action('openAndUploadBoth'),
    openAndUploadDirectory: null,
    openAndUploadFile: null,
    pickAndUploadMixed: Styles.isMobile ? Sb.action('pickAndUploadMixed') : null,
    pickAndUploadPhoto: null,
    pickAndUploadVideo: null,
    style,
  }),
}

const storeCommon = Sb.createStoreWithCommon()
const store = {
  ...storeCommon,
  fs: {
    ...storeCommon.fs,
    downloads: {
      ...storeCommon.fs.downloads,
      ...storeCommon.fs.downloads.info,
      info: new Map<string, Types.DownloadInfo>([
        ['1', {...Constants.emptyDownloadInfo, path: Types.stringToPath('/keybase/public/foo,bar/folder')}],
        ['2', {...Constants.emptyDownloadInfo, path: Types.stringToPath('/keybase/public/foo,bar/file')}],
        ['3', {...Constants.emptyDownloadInfo, path: Types.stringToPath('/keybase/team/kbkbfstest/folder')}],
        ['4', {...Constants.emptyDownloadInfo, path: Types.stringToPath('/keybase/team/kbkbfstest/file')}],
      ]),
      state: new Map<string, Types.DownloadState>([
        ...storeCommon.fs.downloads.state,
        // need the spread to pass "ongoing" check
        ['1', {...Constants.emptyDownloadState}],
        ['2', {...Constants.emptyDownloadState}],
        ['3', {...Constants.emptyDownloadState}],
        ['4', {...Constants.emptyDownloadState}],
      ]),
    },
    pathItems: new Map<Types.Path, Types.PathItem>([
      ...storeCommon.fs.pathItems,
      [
        Types.stringToPath('/keybase/public/foo,bar/folder'),
        {
          ...Constants.emptyFolder,
        },
      ],
      [
        Types.stringToPath('/keybase/public/foo,bar/file'),
        {
          ...Constants.emptyFile,
        },
      ],
      [
        Types.stringToPath('/keybase/team/kbkbfstest/folder'),
        {
          ...Constants.emptyFolder,
        },
      ],
      [
        Types.stringToPath('/keybase/team/kbkbfstest/file'),
        {
          ...Constants.emptyFile,
        },
      ],
    ]),
    tlfs: {
      ...storeCommon.fs.tlfs,
      private: new Map<string, Types.Tlf>([
        ...storeCommon.fs.tlfs.private,
        ['1', Constants.makeTlf({isNew: true, name: '1'})],
      ]),
      public: new Map<string, Types.Tlf>([
        ...storeCommon.fs.tlfs.public,
        ...[...new Array(10).keys()].map(
          i => [i.toString(), Constants.makeTlf({isNew: true, name: i.toString()})] as const
        ),
      ]),
      team: new Map<string, Types.Tlf>([
        ...storeCommon.fs.tlfs.team,
        ...[...new Array(100).keys()].map(
          i => [i.toString(), Constants.makeTlf({isNew: true, name: i.toString()})] as const
        ),
      ]),
    },
  },
}

// @ts-ignore
export const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...store,
})

const pathItemActionCommonProps = {
  clickable: {type: 'icon'} as const,
  initView: Types.PathItemActionMenuView.Root,
}

const pieSlices = [0, 20, 90, 179, 180, 181, 270, 359, 360]

class PieSliceWrapper extends React.PureComponent<
  {
    initialDegrees: number
    darkBackground?: boolean
  },
  {
    degrees: number
  }
> {
  state = {degrees: this.props.initialDegrees}
  _onClick = () => this.setState(({degrees}) => ({degrees: (degrees + 72) % 361}))
  render() {
    return (
      <Kb.Box2
        direction="horizontal"
        gap="small"
        style={{
          backgroundColor: this.props.darkBackground ? Styles.globalColors.blue : Styles.globalColors.white,
        }}
      >
        <Kb.Text
          type="Header"
          style={{
            color: this.props.darkBackground ? Styles.globalColors.white : Styles.globalColors.black,
            margin: Styles.globalMargins.xsmall,
            minWidth: 120,
          }}
        >
          {this.state.degrees} degrees:{' '}
        </Kb.Text>
        <PieSlice
          degrees={this.state.degrees}
          animated={true}
          style={{margin: Styles.globalMargins.small}}
          negative={this.props.darkBackground}
        />
        <Kb.Button
          onClick={this._onClick}
          label="Add progress"
          mode={this.props.darkBackground ? 'Secondary' : 'Primary'}
          style={{margin: Styles.globalMargins.tiny}}
        />
      </Kb.Box2>
    )
  }
}
const load = () => {
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('KbfsPath', () => (
      <Kb.Box style={{padding: Styles.globalMargins.small}}>
        <KbfsPath
          standardPath="/keybase/private/meatball/folder/treat"
          rawPath="/Volumes/Keybase\ (meatball)/private/meatball/folder/treat"
        />
      </Kb.Box>
    ))
    .add('PathInfo', () => <PathInfo path="/keybase/private/meatball/folder/treat" />)
    .add('PathItemInfo', () => <PathItemInfo path="/keybase/private/meatball/folder/treat" />)
    .add('PathItemAction', () => (
      <Kb.Box2
        direction="vertical"
        gap="medium"
        gapStart={true}
        style={{paddingLeft: Styles.globalMargins.medium}}
      >
        <Kb.Text type="Body">Row mode</Kb.Text>
        <PathItemAction
          path={Types.stringToPath('/keybase/private/meatball/folder/treat')}
          mode="row"
          {...pathItemActionCommonProps}
        />
        <Kb.Text type="Body">Screen mode</Kb.Text>
        <PathItemAction
          path={Types.stringToPath('/keybase/private/meatball/folder/treat')}
          mode="screen"
          {...pathItemActionCommonProps}
        />
        <PathItemAction
          path={Types.stringToPath(
            '/keybase/private/meatball/treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat treat'
          )}
          mode="screen"
          {...pathItemActionCommonProps}
        />
        <PathItemAction
          path={Types.stringToPath(
            '/keybaes/private/meatball/foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar'
          )}
          mode="screen"
          {...pathItemActionCommonProps}
        />
      </Kb.Box2>
    ))
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('Errs', () => (
      <Errs
        errs={[
          {
            dismiss: Sb.action('dismiss'),
            msg: 'Error when downloading file blah 1.jpg',
          },
          {
            dismiss: Sb.action('dismiss'),
            msg: 'Error when downloading file blah 2.jpg',
          },
          {
            dismiss: Sb.action('dismiss'),
            msg: 'Error when downloading file blah 99.jpg',
          },
          {
            dismiss: Sb.action('dismiss'),
            msg:
              'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
          },
          {
            dismiss: Sb.action('dismiss'),
            msg:
              'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
          },
        ]}
      />
    ))
    .add('TlfInfoLine', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} fullWidth={true}>
        <Kb.Text type="Body">mode=default reset=false isNew=true</Kb.Text>
        <TlfInfoLine
          isNew={false}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="default"
          reset={false}
        />
        <Kb.Text type="Body">mode=default reset=false</Kb.Text>
        <TlfInfoLine
          isNew={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="default"
          reset={false}
        />
        <Kb.Text type="Body">mode=default reset=true isNew=true</Kb.Text>
        <TlfInfoLine
          isNew={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="default"
          reset={true}
        />
        <Kb.Text type="Body">mode=default reset=true</Kb.Text>
        <TlfInfoLine
          isNew={false}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="default"
          reset={true}
        />
        <Kb.Text type="Body">mode=row reset=Array(1)</Kb.Text>
        <TlfInfoLine
          isNew={false}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={['foo']}
        />
        <Kb.Text type="Body">mode=default reset=Array(2)</Kb.Text>
        <TlfInfoLine
          isNew={false}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="default"
          reset={['foo', 'bar']}
        />
        <Kb.Text type="Body">mode=row reset=Array(3)</Kb.Text>
        <TlfInfoLine
          isNew={false}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={['foo', 'bar', 'cue']}
        />
        <Kb.Text type="Body">mode=row mixedMode=true reset=Array(3)</Kb.Text>
        <TlfInfoLine
          isNew={false}
          mixedMode={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={['foo', 'bar', 'cue']}
        />
        <Kb.Text type="Body">mode=row mixedMode=true reset=true</Kb.Text>
        <TlfInfoLine
          isNew={false}
          mixedMode={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={true}
        />
        <Kb.Text type="Body">mode=row mixedMode=true reset=false</Kb.Text>
        <TlfInfoLine
          isNew={false}
          mixedMode={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={false}
        />
      </Kb.Box2>
    ))
    .add('LastModifiedLine', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} fullWidth={true}>
        <Kb.Text type="Body">mode=default</Kb.Text>
        <LastModifiedLine mode="default" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
        <Kb.Text type="Body">mode=row</Kb.Text>
        <LastModifiedLine mode="row" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
        <Kb.Text type="Body">mode=menu</Kb.Text>
        <LastModifiedLine mode="menu" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
      </Kb.Box2>
    ))
    .add('OpenInSystemFileManager', () => (
      <Kb.Box2 direction="vertical" gap="small">
        <OpenInSystemFileManager path={Types.stringToPath('/keybase')} />
      </Kb.Box2>
    ))
    .add('Sync Status', () => (
      <Kb.Box2 direction="vertical" gap="large" gapStart={true} fullWidth={false} alignItems="center">
        <PathStatusIcon statusIcon={Types.NonUploadStaticSyncStatus.AwaitingToSync} isFolder={false} />
        <PathStatusIcon statusIcon={Types.UploadIcon.AwaitingToUpload} isFolder={false} />
        <PathStatusIcon statusIcon={Types.NonUploadStaticSyncStatus.OnlineOnly} isFolder={false} />
        <PathStatusIcon statusIcon={Types.NonUploadStaticSyncStatus.Synced} isFolder={false} />
        <PathStatusIcon statusIcon={Types.NonUploadStaticSyncStatus.SyncError} isFolder={true} />
        <PathStatusIcon statusIcon={Types.UploadIcon.Uploading} isFolder={false} />
        <PathStatusIcon statusIcon={Types.UploadIcon.UploadingStuck} isFolder={false} />
        <PathStatusIcon statusIcon={Types.LocalConflictStatus} isFolder={false} />
        <PathStatusIcon statusIcon={0.3} isFolder={false} />
      </Kb.Box2>
    ))
    .add('Pie Loaders', () => (
      <Kb.Box2 direction="vertical" fullWidth={false} alignItems="center">
        <Kb.ScrollView>
          {pieSlices.map(deg => (
            <PieSliceWrapper initialDegrees={deg} key={deg} />
          ))}
          {pieSlices.map(deg => (
            <PieSliceWrapper initialDegrees={deg} key={deg} darkBackground={true} />
          ))}
        </Kb.ScrollView>
      </Kb.Box2>
    ))
    .add('ConfirmDelete', () => (
      <ConfirmDelete
        onBack={Sb.action('onBack')}
        onDelete={Sb.action('onDelete')}
        path={Types.stringToPath('/keybase/private/alice/my_folder')}
        title="foo"
      />
    ))

  Sb.storiesOf('Files/ItemIcon', module)
    .addDecorator(provider)
    .add('tlf list', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon key={size.toString()} path={Types.stringToPath('/keybase/private')} size={size} />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon key={size.toString()} path={Types.stringToPath('/keybase/public')} size={size} />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon key={size.toString()} path={Types.stringToPath('/keybase/team')} size={size} />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('in-tlf', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest')}
              size={size}
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest/folder')}
              size={size}
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest/file')}
              size={size}
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar')}
              size={size}
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/folder')}
              size={size}
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/file')}
              size={size}
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public file with badgeOverride</Kb.Text>
          {pathItemIconSizes.map(size => (
            <ItemIcon
              badgeOverride="iconfont-attachment"
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/file')}
              size={size}
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
}

const pathItemIconSizes: Array<Size> = [16, 32, 48, 96]

export default load

import React from 'react'
import {isMobile} from '../../constants/platform'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import PathItemAction from './path-item-action'
import PathItemIcon, {Size} from './path-item-icon'
import PathItemInfo from './path-item-info'
import TlfInfo from './tlf-info'
import Errs from './errs'
import OpenInSystemFileManager from './open-in-system-file-manager'
import {OwnProps as PathItemIconOwnProps} from './path-item-icon-container'
import {OwnProps as PathItemInfoOwnProps} from './path-item-info-container'
import {OwnProps as TlfInfoOwnProps} from './tlf-info-container'
import SyncStatus from './sync-status'
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

const pathItemActionProps = (props: any) => ({
  ...props,
  init: Sb.action('init'),
  onHidden: Sb.action('onHidden'),
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
    pathItem: Constants.makeFolder(),
    ...props,
  }),
  FolderViewFilterIcon: (props: any) => ({
    onUpdate: Sb.action('onUpdate'),
    pathItem: Constants.makeFolder(),
    ...props,
  }),
  LoadPathMetadataWhenNeeded: ({path}: {path: Types.Path}) => ({
    loadPathMetadataWithRefreshTag: Sb.action('loadPathMetadataWithRefreshTag'),
    loadPathMetadataWithoutRefreshTag: Sb.action('loadPathMetadataWithoutRefreshTag'),
    path,
    syncingFoldersProgress: Constants.makeSyncingFoldersProgress(),
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
  PathItemAction: pathItemActionProps,
  PathItemActionChooseView: pathItemActionChooseViewProps,
  PathItemActionMenu: PathItemActionMenuProps,
  PathItemActionMenuHeader: PathItemActionMenuHeaderProps,
  PathItemIcon: (ownProps: PathItemIconOwnProps) => ({
    ...ownProps,
    type: Types.getPathElements(ownProps.path).length > 4 ? Types.PathType.File : Types.PathType.Folder,
    username: 'songgao_test',
  }),
  PathItemInfo: ({path, mode}: PathItemInfoOwnProps) => ({
    lastModifiedTimestamp: Types.getPathElements(path).length > 3 ? 1545110765 : undefined,
    lastWriter: 'songgao_test',
    mode,
  }),
  RefreshDriverStatusOnMount: () => ({
    refresh: Sb.action('refresh'),
  }),
  RefreshSettings: () => ({
    refresh: Sb.action('refresh'),
  }),
  SyncStatus: () => ({
    folder: false,
    status: 'online-only',
  }),
  SyncingFolders: () => ({
    progress: 0.67,
    show: true,
  }),
  TlfInfo: ({mixedMode, mode}: TlfInfoOwnProps) => ({
    mixedMode,
    mode,
    reset: ['foo', 'bar', 'cue'],
    tlfMtime: 1564784024580,
    tlfType: Types.TlfType.Private,
  }),
  TryEnableDriverOnFocus: () => ({
    appFocusedCount: 1,
    driverStatus: Constants.makeDriverStatusEnabled(),
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

export const provider = Sb.createPropProviderWithCommon(commonProvider)

const pathItemActionCommonProps = {
  clickable: {type: 'icon'} as const,
  init: Sb.action('init'),
  onHidden: Sb.action('onHidden'),
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
            key: '1',
            msg: 'Error when downloading file blah 1.jpg',
            time: 1534362428795,
          },
          {
            dismiss: Sb.action('dismiss'),
            key: '2',
            msg: 'Error when downloading file blah 2.jpg',
            retry: Sb.action('retry'),
            time: 1534362428795,
          },
          {
            dismiss: Sb.action('dismiss'),
            key: '3',
            msg: 'Error when downloading file blah 99.jpg',
            onFeedback: Sb.action('onFeedback'),
            retry: Sb.action('retry'),
            time: 1534362428795,
          },
          {
            dismiss: Sb.action('dismiss'),
            key: '4',
            msg:
              'foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo foo',
            onFeedback: Sb.action('onFeedback'),
            retry: Sb.action('retry'),
            time: 1534362428795,
          },
          {
            dismiss: Sb.action('dismiss'),
            key: '5',
            msg:
              'foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar,foo,bar',
            onFeedback: Sb.action('onFeedback'),
            retry: Sb.action('retry'),
            time: 1534362428795,
          },
        ]}
      />
    ))
    .add('TlfInfo', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} fullWidth={true}>
        <Kb.Text type="Body">mode=default reset=false</Kb.Text>
        <TlfInfo tlfMtime={1564784024580} tlfType={Types.TlfType.Private} mode="default" reset={false} />
        <Kb.Text type="Body">mode=default reset=true</Kb.Text>
        <TlfInfo tlfMtime={1564784024580} tlfType={Types.TlfType.Private} mode="default" reset={true} />
        <Kb.Text type="Body">mode=row reset=Array(1)</Kb.Text>
        <TlfInfo tlfMtime={1564784024580} tlfType={Types.TlfType.Private} mode="row" reset={['foo']} />
        <Kb.Text type="Body">mode=default reset=Array(2)</Kb.Text>
        <TlfInfo
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="default"
          reset={['foo', 'bar']}
        />
        <Kb.Text type="Body">mode=row reset=Array(3)</Kb.Text>
        <TlfInfo
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={['foo', 'bar', 'cue']}
        />
        <Kb.Text type="Body">mode=row mixedMode=true reset=Array(3)</Kb.Text>
        <TlfInfo
          mixedMode={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={['foo', 'bar', 'cue']}
        />
        <Kb.Text type="Body">mode=row mixedMode=true reset=true</Kb.Text>
        <TlfInfo
          mixedMode={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={true}
        />
        <Kb.Text type="Body">mode=row mixedMode=true reset=false</Kb.Text>
        <TlfInfo
          mixedMode={true}
          tlfMtime={1564784024580}
          tlfType={Types.TlfType.Private}
          mode="row"
          reset={false}
        />
      </Kb.Box2>
    ))
    .add('PathItemInfo', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} fullWidth={true}>
        <Kb.Text type="Body">mode=default</Kb.Text>
        <PathItemInfo mode="default" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
        <Kb.Text type="Body">mode=row</Kb.Text>
        <PathItemInfo mode="row" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
        <Kb.Text type="Body">mode=menu</Kb.Text>
        <PathItemInfo mode="menu" lastModifiedTimestamp={1545110765} lastWriter="songgao_test" />
      </Kb.Box2>
    ))
    .add('OpenInSystemFileManager', () => (
      <Kb.Box2 direction="vertical" gap="small">
        <Kb.Text type="Body">disabled</Kb.Text>
        <OpenInSystemFileManager
          driverEnabled={false}
          openInSystemFileManager={Sb.action('openInSystemFileManager')}
          enableDriver={Sb.action('enableDriver')}
        />
        <Kb.Text type="Body">enabled</Kb.Text>
        <OpenInSystemFileManager
          driverEnabled={true}
          openInSystemFileManager={Sb.action('openInSystemFileManager')}
          enableDriver={Sb.action('enableDriver')}
        />
      </Kb.Box2>
    ))
    .add('Sync Status', () => (
      <Kb.Box2 direction="vertical" gap="large" gapStart={true} fullWidth={false} alignItems={'center'}>
        <SyncStatus status={Types.SyncStatusStatic.AwaitingToSync} folder={false} />
        <SyncStatus status={Types.SyncStatusStatic.AwaitingToUpload} folder={false} />
        <SyncStatus status={Types.SyncStatusStatic.OnlineOnly} folder={false} />
        <SyncStatus status={Types.SyncStatusStatic.Synced} folder={false} />
        <SyncStatus status={Types.SyncStatusStatic.SyncError} folder={true} />
        <SyncStatus status={Types.SyncStatusStatic.Uploading} folder={false} />
        <SyncStatus status={0.3} folder={false} />
      </Kb.Box2>
    ))
    .add('Pie Loaders', () => (
      <Kb.Box2 direction="vertical" fullWidth={false} alignItems={'center'}>
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

  Sb.storiesOf('Files/PathItemIcon', module)
    .add('tlf list', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public')}
              size={size}
              type={Types.PathType.File}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('team', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">team file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
              size={size}
              type={Types.PathType.File}
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('private', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private/foo,bar')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private/foo,bar/foo')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">private file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/private/foo,bar/foo')}
              size={size}
              type={Types.PathType.File}
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
    .add('public', () => (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public tlf</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public folder</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/foo')}
              size={size}
              type={Types.PathType.Folder}
              username=""
            />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
          <Kb.Text type="Header">public file</Kb.Text>
          {pathItemIconSizes.map(size => (
            <PathItemIcon
              key={size.toString()}
              path={Types.stringToPath('/keybase/public/foo,bar/foo')}
              size={size}
              type={Types.PathType.File}
              username=""
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    ))
  ;[32 as 32, 48 as 48].forEach(size =>
    Sb.storiesOf('Files/PathItemIcon', module).add(`badged - ${size}`, () => (
      <Kb.Box2 direction="vertical" gap="large" gapStart={true}>
        {[Types.PathItemBadgeType.New, Types.PathItemBadgeType.Rekey].map(badge => (
          <Kb.Box2 key={badge} direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
            <Kb.Text type="Header">{badge}</Kb.Text>
            <PathItemIcon
              path={Types.stringToPath('/keybase/private/foo,bar')}
              size={size}
              type={Types.PathType.Folder}
              username=""
              badge={badge}
            />
          </Kb.Box2>
        ))}
        {[Types.PathItemBadgeType.Upload, Types.PathItemBadgeType.Download].map(badge => (
          <>
            <Kb.Box2 key="file" direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
              <Kb.Text type="Header">{badge} - file</Kb.Text>
              <PathItemIcon
                path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
                size={size}
                type={Types.PathType.File}
                username=""
                badge={badge}
              />
            </Kb.Box2>
            <Kb.Box2 key="folder" direction="horizontal" gap="small" gapStart={true} centerChildren={true}>
              <Kb.Text type="Header">{badge} - folder</Kb.Text>
              <PathItemIcon
                path={Types.stringToPath('/keybase/team/kbkbfstest/foo')}
                size={size}
                type={Types.PathType.Folder}
                username=""
                badge={badge}
              />
            </Kb.Box2>
          </>
        ))}
        {[1, 10, 100].map(badge => (
          <Kb.Box2
            key={badge.toString()}
            direction="horizontal"
            gap="small"
            gapStart={true}
            centerChildren={true}
          >
            <Kb.Text type="Header">{badge}</Kb.Text>
            <PathItemIcon
              path={Types.stringToPath('/keybase/private/foo,bar')}
              size={size}
              type={Types.PathType.Folder}
              username=""
              badge={badge}
            />
          </Kb.Box2>
        ))}
      </Kb.Box2>
    ))
  )
}

const pathItemIconSizes: Array<Size> = [12, 16, 32, 48, 64, 96]

export default load

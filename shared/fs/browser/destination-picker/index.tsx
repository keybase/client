import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as Container from '@/util/container'
import * as FsCommon from '@/fs/common'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RowCommon from '../rows/common'
import * as T from '@/constants/types'
import NavHeaderTitle from '@/fs/nav-header/title'
import Root from '../root'
import Rows from '../rows/rows-container'
import {OriginalOrCompressedButton} from '@/incoming-share'

type OwnProps = {index: number}

const getIndex = (ownProps: OwnProps) => ownProps.index
const getDestinationParentPath = (dp: T.FS.DestinationPicker, ownProps: OwnProps): T.FS.Path =>
  dp.destinationParentPath[getIndex(ownProps)] ||
  (dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy
    ? T.FS.getPathParent(dp.source.path)
    : T.FS.stringToPath('/keybase'))

const canWrite = (dp: T.FS.DestinationPicker, pathItems: T.FS.PathItems, ownProps: OwnProps) =>
  T.FS.getPathLevel(getDestinationParentPath(dp, ownProps)) > 2 &&
  Constants.getPathItem(pathItems, getDestinationParentPath(dp, ownProps)).writable

const canCopy = (dp: T.FS.DestinationPicker, pathItems: T.FS.PathItems, ownProps: OwnProps) => {
  if (!canWrite(dp, pathItems, ownProps)) {
    return false
  }
  if (dp.source.type === T.FS.DestinationPickerSource.IncomingShare) {
    return true
  }
  if (dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy) {
    const source: T.FS.MoveOrCopySource = dp.source
    return getDestinationParentPath(dp, ownProps) !== T.FS.getPathParent(source.path)
  }
  return undefined
}

const canMove = (dp: T.FS.DestinationPicker, pathItems: T.FS.PathItems, ownProps: OwnProps) =>
  canCopy(dp, pathItems, ownProps) &&
  dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy &&
  Constants.pathsInSameTlf(dp.source.path, getDestinationParentPath(dp, ownProps))

const canBackUp = C.isMobile
  ? (dp: T.FS.DestinationPicker, ownProps: OwnProps) =>
      T.FS.getPathLevel(getDestinationParentPath(dp, ownProps)) > 1
  : () => false

const ConnectedDestinationPicker = (ownProps: OwnProps) => {
  const destPicker = C.useFSState(s => s.destinationPicker)
  const isShare = destPicker.source.type === T.FS.DestinationPickerSource.IncomingShare
  const pathItems = C.useFSState(s => s.pathItems)
  const headerRightButton =
    destPicker.source.type === T.FS.DestinationPickerSource.IncomingShare ? (
      <OriginalOrCompressedButton incomingShareItems={destPicker.source.source} />
    ) : undefined

  const nav = Container.useSafeNavigation()

  const newFolderRow = C.useFSState(s => s.dispatch.newFolderRow)
  const moveOrCopy = C.useFSState(s => s.dispatch.moveOrCopy)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const dispatchProps = {
    _onBackUp: (currentPath: T.FS.Path) =>
      Constants.makeActionsForDestinationPickerOpen(getIndex(ownProps) + 1, T.FS.getPathParent(currentPath)),
    _onCopyHere: (destinationParentPath: T.FS.Path) => {
      moveOrCopy(destinationParentPath, 'copy')
      clearModals()
      nav.safeNavigateAppend({props: {path: destinationParentPath}, selected: 'fsRoot'})
    },
    _onMoveHere: (destinationParentPath: T.FS.Path) => {
      moveOrCopy(destinationParentPath, 'move')
      clearModals()
      nav.safeNavigateAppend({props: {path: destinationParentPath}, selected: 'fsRoot'})
    },
    _onNewFolder: (destinationParentPath: T.FS.Path) => {
      newFolderRow(destinationParentPath)
    },
    onBack: () => {
      navigateUp()
    },
    onCancel: () => {
      clearModals()
    },
  }

  const index = getIndex(ownProps)
  const showHeaderBackInsteadOfCancel = isShare // && index > 0
  const targetName = Constants.getDestinationPickerPathName(destPicker)
  // If we are are dealing with incoming share, the first view is root,
  // so rely on the header back button instead of showing a separate row
  // for going to parent directory.
  const onBack = showHeaderBackInsteadOfCancel ? dispatchProps.onBack : undefined
  const onBackUp =
    isShare || !canBackUp(destPicker, ownProps)
      ? undefined
      : () => dispatchProps._onBackUp(getDestinationParentPath(destPicker, ownProps))
  const onCancel = showHeaderBackInsteadOfCancel ? undefined : dispatchProps.onCancel
  const onCopyHere = canCopy(destPicker, pathItems, ownProps)
    ? () => dispatchProps._onCopyHere(getDestinationParentPath(destPicker, ownProps))
    : undefined
  const onMoveHere = canMove(destPicker, pathItems, ownProps)
    ? () => dispatchProps._onMoveHere(getDestinationParentPath(destPicker, ownProps))
    : undefined
  const onNewFolder =
    canWrite(destPicker, pathItems, ownProps) && !isShare
      ? () => dispatchProps._onNewFolder(getDestinationParentPath(destPicker, ownProps))
      : undefined
  const parentPath = getDestinationParentPath(destPicker, ownProps)

  FsCommon.useFsPathMetadata(parentPath)
  FsCommon.useFsTlfs()
  FsCommon.useFsOnlineStatus()
  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        leftButton: makeLeftButton(onCancel, onBack),
        rightButton: headerRightButton,
        title: makeTitle(targetName, parentPath),
      }}
      noScrollView={true}
      mode="Wide"
    >
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} fullWidth={true} fullHeight={true}>
        {!Kb.Styles.isMobile && (
          <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.anotherHeader}>
            <NavHeaderTitle inDestinationPicker={true} path={parentPath} />
            {!!onNewFolder && <NewFolder onNewFolder={onNewFolder} />}
          </Kb.Box2>
        )}
        <Kb.Divider key="dheader" />
        {!!onBackUp && (
          <Kb.ClickableBox key="up" style={styles.actionRowContainer} onClick={onBackUp}>
            <Kb.Icon
              type="iconfont-folder-up"
              color={Kb.Styles.globalColors.black_50}
              fontSize={32}
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold">..</Kb.Text>
          </Kb.ClickableBox>
        )}
        {!!onCopyHere && (
          <Kb.ClickableBox key="copy" style={styles.actionRowContainer} onClick={onCopyHere}>
            <Kb.Icon
              type="icon-folder-copy-32"
              color={Kb.Styles.globalColors.blue}
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold" style={styles.actionText}>
              {isShare ? 'Save here' : 'Copy here'}
            </Kb.Text>
          </Kb.ClickableBox>
        )}
        {!!onMoveHere && (
          <Kb.ClickableBox key="move" style={styles.actionRowContainer} onClick={onMoveHere}>
            <Kb.Icon
              type="icon-folder-move-32"
              color={Kb.Styles.globalColors.blue}
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold" style={styles.actionText}>
              Move here
            </Kb.Text>
          </Kb.ClickableBox>
        )}
        {parentPath === C.FS.defaultPath ? (
          <Root destinationPickerIndex={index} />
        ) : (
          <Rows path={parentPath} destinationPickerIndex={index} />
        )}
        {Kb.Styles.isMobile && <Kb.Divider key="dfooter" />}
        {(!Kb.Styles.isMobile || onNewFolder) && (
          <Kb.Box2
            key="footer"
            direction="horizontal"
            centerChildren={true}
            fullWidth={true}
            style={styles.footer}
          >
            {Kb.Styles.isMobile ? (
              <NewFolder onNewFolder={onNewFolder} />
            ) : (
              <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
            )}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const NewFolder = (p: {onNewFolder?: () => void}) => {
  const {onNewFolder} = p
  return (
    <Kb.ClickableBox style={styles.newFolderBox} onClick={onNewFolder}>
      <Kb.Icon type="iconfont-folder-new" color={Kb.Styles.globalColors.blue} />
      <Kb.Text type="BodyBig" style={styles.newFolderText}>
        Create new folder
      </Kb.Text>
    </Kb.ClickableBox>
  )
}

const makeLeftButton = (onCancel?: () => void, onBack?: () => void) => {
  if (!Kb.Styles.isMobile) {
    return undefined
  }
  if (onCancel) {
    return (
      <Kb.Text type="BodyBigLink" onClick={onCancel}>
        Cancel
      </Kb.Text>
    )
  }
  if (onBack) {
    return (
      <Kb.Text type="BodyBigLink" onClick={onBack}>
        Back
      </Kb.Text>
    )
  }
  return undefined
}

const makeTitle = (targetName: string, parentPath: T.FS.Path) => {
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <FsCommon.Filename type="BodyTiny" filename={targetName} />
        <Kb.Text type="BodyBig">Save in...</Kb.Text>
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.desktopHeader} gap="xtiny">
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        Move or Copy “
      </Kb.Text>
      <FsCommon.ItemIcon size={16} path={T.FS.pathConcat(parentPath, targetName)} />
      <FsCommon.Filename type="Header" filename={targetName} />
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        ”
      </Kb.Text>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionRowContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        flexShrink: 0,
        height: RowCommon.normalRowHeight,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      actionText: {
        color: Kb.Styles.globalColors.blueDark,
      },
      anotherHeader: {
        height: 48,
        justifyContent: 'space-between',
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      desktopHeader: Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.medium, 10),
      footer: Kb.Styles.platformStyles({
        common: {
          height: 64,
        },
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white_90,
          bottom: 0,
          position: 'absolute',
        },
      }),
      newFolderBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        padding: Kb.Styles.globalMargins.tiny,
      },
      newFolderText: {
        color: Kb.Styles.globalColors.blueDark,
        marginLeft: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default ConnectedDestinationPicker

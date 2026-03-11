import * as C from '@/constants'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as FsCommon from '@/fs/common'
import * as Kb from '@/common-adapters'
import * as RowCommon from './rows/common'
import * as T from '@/constants/types'
import NavHeaderTitle from '@/fs/nav-header/title'
import Root from './root'
import Rows from './rows/rows-container'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {index: number}

const getParentPath = (dp: T.FS.DestinationPicker, index: number): T.FS.Path =>
  dp.destinationParentPath[index] ||
  (dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy
    ? T.FS.getPathParent(dp.source.path)
    : T.FS.stringToPath('/keybase'))

const canBackUp = C.isMobile
  ? (parentPath: T.FS.Path) => T.FS.getPathLevel(parentPath) > 1
  : () => false

const ConnectedDestinationPicker = (ownProps: OwnProps) => {
  const index = ownProps.index
  const {parentPath, isShare, isWritable, isCopyable, isMovable, moveOrCopy, newFolderRow} = useFSState(
    C.useShallow(s => {
      const dp = s.destinationPicker
      const pp = getParentPath(dp, index)
      const pathItem = FS.getPathItem(s.pathItems, pp)
      const writable = T.FS.getPathLevel(pp) > 2 && pathItem.writable
      const isShareSource = dp.source.type === T.FS.DestinationPickerSource.IncomingShare
      const isMoveOrCopy = dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy
      const copyable = writable && (isShareSource || (isMoveOrCopy && pp !== T.FS.getPathParent(dp.source.path)))
      const movable = copyable && isMoveOrCopy && FS.pathsInSameTlf(dp.source.path, pp)
      return {
        isCopyable: copyable,
        isMovable: movable,
        isShare: isShareSource,
        isWritable: writable,
        moveOrCopy: s.dispatch.moveOrCopy,
        newFolderRow: s.dispatch.newFolderRow,
        parentPath: pp,
      }
    })
  )

  const nav = useSafeNavigation()
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onBackUp =
    isShare || !canBackUp(parentPath)
      ? undefined
      : () => FS.makeActionsForDestinationPickerOpen(index + 1, T.FS.getPathParent(parentPath))
  const onCancel = isShare ? undefined : () => clearModals()
  const onCopyHere = isCopyable
    ? () => {
        moveOrCopy(parentPath, 'copy')
        clearModals()
        nav.safeNavigateAppend({name: 'fsRoot', params: {path: parentPath}})
      }
    : undefined
  const onMoveHere = isMovable
    ? () => {
        moveOrCopy(parentPath, 'move')
        clearModals()
        nav.safeNavigateAppend({name: 'fsRoot', params: {path: parentPath}})
      }
    : undefined
  const onNewFolder =
    isWritable && !isShare
      ? () => newFolderRow(parentPath)
      : undefined

  FsCommon.useFsPathMetadata(parentPath)
  FsCommon.useFsTlfs()
  FsCommon.useFsOnlineStatus()

  return (
    <>
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} fullWidth={true} fullHeight={true}>
        {!Kb.Styles.isMobile && (
          <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.anotherHeader} justifyContent="space-between">
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
            <Kb.ImageIcon
              type="icon-folder-copy-32"
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold" style={styles.actionText}>
              {isShare ? 'Save here' : 'Copy here'}
            </Kb.Text>
          </Kb.ClickableBox>
        )}
        {!!onMoveHere && (
          <Kb.ClickableBox key="move" style={styles.actionRowContainer} onClick={onMoveHere}>
            <Kb.ImageIcon
              type="icon-folder-move-32"
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold" style={styles.actionText}>
              Move here
            </Kb.Text>
          </Kb.ClickableBox>
        )}
        {parentPath === FS.defaultPath ? (
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
    </>
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
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
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

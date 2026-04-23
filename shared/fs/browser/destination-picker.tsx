import * as C from '@/constants'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as FsCommon from '@/fs/common'
import * as Kb from '@/common-adapters'
import * as RowCommon from './rows/common'
import * as T from '@/constants/types'
import NavHeaderTitle from '@/fs/nav-header/title'
import Root from './root'
import {FsBrowserEditProvider, useFsBrowserEdits} from './edit-state'
import Rows from './rows/rows-container'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  parentPath: T.FS.Path
  source: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
}

const canBackUp = C.isMobile
  ? (parentPath: T.FS.Path) => T.FS.getPathLevel(parentPath) > 1
  : () => false

const ConnectedDestinationPicker = (ownProps: OwnProps) => {
  const {parentPath, source} = ownProps
  const parentPathItem = FsCommon.useFsPathMetadata(parentPath)
  const browserEdits = useFsBrowserEdits()
  const {isShare, isWritable, isCopyable, isMovable, moveOrCopy, storeNewFolderRow} = useFSState(
    C.useShallow(s => {
      const writable = T.FS.getPathLevel(parentPath) > 2 && parentPathItem.writable
      const isShareSource = source.type === T.FS.DestinationPickerSource.IncomingShare
      const isMoveOrCopy = source.type === T.FS.DestinationPickerSource.MoveOrCopy
      const copyable =
        writable && (isShareSource || (isMoveOrCopy && parentPath !== T.FS.getPathParent(source.path)))
      const movable = copyable && isMoveOrCopy && FS.pathsInSameTlf(source.path, parentPath)
      return {
        isCopyable: copyable,
        isMovable: movable,
        isShare: isShareSource,
        isWritable: writable,
        moveOrCopy: s.dispatch.moveOrCopy,
        storeNewFolderRow: s.dispatch.newFolderRow,
      }
    })
  )
  const newFolderRow = browserEdits?.newFolderRow ?? storeNewFolderRow

  const nav = useSafeNavigation()
  const clearModals = C.Router2.clearModals
  const onBackUp =
    isShare || !canBackUp(parentPath)
      ? undefined
      : () =>
          nav.safeNavigateAppend({
            name: 'destinationPicker',
            params: {parentPath: T.FS.getPathParent(parentPath), source},
          })
  const onCancel = isShare ? undefined : () => clearModals()
  const onCopyHere = isCopyable
    ? () => {
        moveOrCopy(parentPath, source, 'copy')
        clearModals()
        nav.safeNavigateAppend({name: 'fsRoot', params: {path: parentPath}})
      }
    : undefined
  const onMoveHere = isMovable
    ? () => {
        moveOrCopy(parentPath, source, 'move')
        clearModals()
        nav.safeNavigateAppend({name: 'fsRoot', params: {path: parentPath}})
      }
    : undefined
  const onNewFolder =
    isWritable && !isShare
      ? () => newFolderRow(parentPath)
      : undefined

  FsCommon.useFsTlfs()
  FsCommon.useFsOnlineStatus()

  return (
    <>
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} fullWidth={true} fullHeight={true}>
        {!Kb.Styles.isMobile && (
          <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.anotherHeader} justifyContent="space-between">
            <NavHeaderTitle destinationPickerSource={source} inDestinationPicker={true} path={parentPath} />
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
          <Root destinationPickerSource={source} />
        ) : (
          <Rows path={parentPath} destinationPickerSource={source} />
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

const Screen = (props: OwnProps) => (
  <FsBrowserEditProvider>
    <ConnectedDestinationPicker {...props} />
  </FsBrowserEditProvider>
)

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

export default Screen

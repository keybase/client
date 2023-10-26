import * as React from 'react'
import * as T from '../../../constants/types'
import * as C from '../../../constants'
import * as Kb from '../../../common-adapters'
import Rows from '../rows/rows-container'
import Root from '../root'
import * as FsCommon from '../../common'
import * as RowCommon from '../rows/common'
import NavHeaderTitle from '../../nav-header/title'

type Props = {
  index: number
  isShare: boolean
  parentPath: T.FS.Path
  targetName: string
  onBack?: () => void
  onCancel?: () => void
  onCopyHere?: () => void
  onMoveHere?: () => void
  onNewFolder?: () => void
  onBackUp?: () => void
  customComponent?: React.ReactNode | null
  headerStyle?: Kb.Styles.StylesCrossPlatform
  headerRightButton?: React.ReactNode
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

const makeLeftButton = (props: Props) => {
  if (!Kb.Styles.isMobile) {
    return undefined
  }
  if (props.onCancel) {
    return (
      <Kb.Text type="BodyBigLink" onClick={props.onCancel}>
        Cancel
      </Kb.Text>
    )
  }
  if (props.onBack) {
    return (
      <Kb.Text type="BodyBigLink" onClick={props.onBack}>
        Back
      </Kb.Text>
    )
  }
  return undefined
}

const makeTitle = (props: Props) => {
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <FsCommon.Filename type="BodyTiny" filename={props.targetName} />
        <Kb.Text type="BodyBig">Save in...</Kb.Text>
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.desktopHeader} gap="xtiny">
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        Move or Copy “
      </Kb.Text>
      <FsCommon.ItemIcon size={16} path={T.FS.pathConcat(props.parentPath, props.targetName)} />
      <FsCommon.Filename type="Header" filename={props.targetName} />
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        ”
      </Kb.Text>
    </Kb.Box2>
  )
}

const DestinationPicker = (props: Props) => {
  FsCommon.useFsPathMetadata(props.parentPath)
  FsCommon.useFsTlfs()
  FsCommon.useFsOnlineStatus()
  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        leftButton: makeLeftButton(props),
        rightButton: props.headerRightButton,
        title: makeTitle(props),
      }}
      noScrollView={true}
      mode="Wide"
    >
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} fullWidth={true} fullHeight={true}>
        {!Kb.Styles.isMobile && (
          <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.anotherHeader}>
            <NavHeaderTitle inDestinationPicker={true} path={props.parentPath} />
            {!!props.onNewFolder && <NewFolder onNewFolder={props.onNewFolder} />}
          </Kb.Box2>
        )}
        <Kb.Divider key="dheader" />
        {!!props.onBackUp && (
          <Kb.ClickableBox key="up" style={styles.actionRowContainer} onClick={props.onBackUp}>
            <Kb.Icon
              type="iconfont-folder-up"
              color={Kb.Styles.globalColors.black_50}
              fontSize={32}
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold">..</Kb.Text>
          </Kb.ClickableBox>
        )}
        {!!props.onCopyHere && (
          <Kb.ClickableBox key="copy" style={styles.actionRowContainer} onClick={props.onCopyHere}>
            <Kb.Icon
              type="icon-folder-copy-32"
              color={Kb.Styles.globalColors.blue}
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold" style={styles.actionText}>
              {props.isShare ? 'Save here' : 'Copy here'}
            </Kb.Text>
          </Kb.ClickableBox>
        )}
        {!!props.onMoveHere && (
          <Kb.ClickableBox key="move" style={styles.actionRowContainer} onClick={props.onMoveHere}>
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
        {props.parentPath === C.defaultPath ? (
          <Root destinationPickerIndex={props.index} />
        ) : (
          <Rows path={props.parentPath} destinationPickerIndex={props.index} />
        )}
        {Kb.Styles.isMobile && <Kb.Divider key="dfooter" />}
        {(!Kb.Styles.isMobile || props.onNewFolder) && (
          <Kb.Box2
            key="footer"
            direction="horizontal"
            centerChildren={true}
            fullWidth={true}
            style={styles.footer}
          >
            {Kb.Styles.isMobile ? (
              <NewFolder onNewFolder={props.onNewFolder} />
            ) : (
              <Kb.Button type="Dim" label="Cancel" onClick={props.onCancel} />
            )}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

export default DestinationPicker

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

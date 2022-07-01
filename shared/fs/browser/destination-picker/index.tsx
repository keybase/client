import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import Rows from '../rows/rows-container'
import Root from '../root'
import * as FsCommon from '../../common'
import * as RowCommon from '../rows/common'
import NavHeaderTitle from '../../nav-header/title'

type Props = {
  index: number
  isShare: boolean
  parentPath: Types.Path
  targetName: string
  onBack?: () => void
  onCancel?: () => void
  onCopyHere?: () => void
  onMoveHere?: () => void
  onNewFolder?: () => void
  onBackUp?: () => void
  customComponent?: React.ReactNode | null
  headerStyle?: Styles.StylesCrossPlatform
  headerRightButton?: React.ReactNode
}

const NewFolder = ({onNewFolder}) => (
  <Kb.ClickableBox style={styles.newFolderBox} onClick={onNewFolder}>
    <Kb.Icon type="iconfont-folder-new" color={Styles.globalColors.blue} />
    <Kb.Text type="BodyBig" style={styles.newFolderText}>
      Create new folder
    </Kb.Text>
  </Kb.ClickableBox>
)

const makeLeftButton = (props: Props) => {
  if (!Styles.isMobile) {
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
  if (Styles.isMobile) {
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
      <FsCommon.ItemIcon size={16} path={Types.pathConcat(props.parentPath, props.targetName)} />
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
      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne} fullWidth={true} fullHeight={true}>
        {!Styles.isMobile && (
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
              color={Styles.globalColors.black_50}
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
              color={Styles.globalColors.blue}
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
              color={Styles.globalColors.blue}
              style={RowCommon.rowStyles.pathItemIcon}
            />
            <Kb.Text type="BodySemibold" style={styles.actionText}>
              Move here
            </Kb.Text>
          </Kb.ClickableBox>
        )}
        {props.parentPath === Constants.defaultPath ? (
          <Root destinationPickerIndex={props.index} />
        ) : (
          <Rows path={props.parentPath} destinationPickerIndex={props.index} />
        )}
        {Styles.isMobile && <Kb.Divider key="dfooter" />}
        {(!Styles.isMobile || props.onNewFolder) && (
          <Kb.Box2
            key="footer"
            direction="horizontal"
            centerChildren={true}
            fullWidth={true}
            style={styles.footer}
          >
            {Styles.isMobile ? (
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionRowContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blueLighter3,
        flexShrink: 0,
        height: RowCommon.normalRowHeight,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      actionText: {
        color: Styles.globalColors.blueDark,
      },
      anotherHeader: {
        height: 48,
        justifyContent: 'space-between',
        paddingRight: Styles.globalMargins.tiny,
      },
      desktopHeader: Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.medium, 10),
      footer: Styles.platformStyles({
        common: {
          height: 64,
        },
        isElectron: {
          backgroundColor: Styles.globalColors.white_90,
          bottom: 0,
          position: 'absolute',
        },
      }),
      newFolderBox: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        padding: Styles.globalMargins.tiny,
      },
      newFolderText: {
        color: Styles.globalColors.blueDark,
        marginLeft: Styles.globalMargins.tiny,
      },
    } as const)
)

// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {withProps} from 'recompose'
import {isMobile} from '../../constants/platform'
import Rows from '../row/rows-container'
import * as FsCommon from '../common'
import * as RowCommon from '../row/common'
import Breadcrumb from '../header/breadcrumb-container.desktop.js'

type Props = {
  index: number,
  parentPath: Types.Path,
  routePath: I.List<string>,
  targetName: string,
  onCancel: (() => void) | null,
  onCopyHere?: ?() => void,
  onMoveHere?: ?() => void,
  onNewFolder?: ?() => void,
  onBackUp?: ?() => void,
}

const NewFolder = ({onNewFolder}) => (
  <Kb.ClickableBox style={styles.newFolderBox} onClick={onNewFolder}>
    <Kb.Icon type="iconfont-folder-new" color={Styles.globalColors.blue} />
    <Kb.Text type="BodyBig" style={styles.newFolderText}>
      Create new folder
    </Kb.Text>
  </Kb.ClickableBox>
)

const DesktopHeaders = (props: Props) => (
  <>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.desktopHeader} gap="xtiny">
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        Move or Copy “
      </Kb.Text>
      <FsCommon.PathItemIcon size={16} path={Types.pathConcat(props.parentPath, props.targetName)} />
      <Kb.Text type="Header" lineClamp={1}>
        {props.targetName}
      </Kb.Text>
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        ”
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.anotherHeader}>
      <Breadcrumb path={props.parentPath} inDestinationPicker={true} routePath={props.routePath} />
      {!!props.onNewFolder && <NewFolder onNewFolder={props.onNewFolder} />}
    </Kb.Box2>
  </>
)

const DestinationPicker = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
    {!isMobile && <DesktopHeaders {...props} />}
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
          Copy here
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
    <Kb.Box2 key="rows" direction="vertical" fullHeight={true} style={styles.rowsContainer}>
      <Rows
        path={props.parentPath}
        sortSetting={Constants.defaultSortSetting}
        destinationPickerIndex={props.index}
        routePath={props.routePath}
      />
    </Kb.Box2>
    {isMobile && <Kb.Divider key="dfooter" />}
    <Kb.Box2 key="footer" direction="horizontal" centerChildren={true} fullWidth={true} style={styles.footer}>
      {isMobile ? (
        <NewFolder onNewFolder={props.onNewFolder} />
      ) : (
        <Kb.Button type="Secondary" label="Cancel" onClick={props.onCancel} />
      )}
    </Kb.Box2>
  </Kb.Box2>
)

export default (isMobile
  ? withProps<_, any>(props => ({
      customComponent: (
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.ClickableBox style={styles.mobileHeaderButton} onClick={props.onCancel}>
            <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
          </Kb.ClickableBox>
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.mobileHeaderContent}>
            <Kb.Box2 direction="horizontal" centerChildren={true} gap="xtiny">
              <FsCommon.PathItemIcon size={12} path={Types.pathConcat(props.parentPath, props.targetName)} />
              <Kb.Text type="BodySmallSemibold" lineClamp={1}>
                {props.targetName}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Text type="Header" lineClamp={1}>
              {Types.getPathName(props.parentPath)}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      ),
      headerStyle: {paddingRight: 0},
      onCancel: null, // unset this to avoid onCancel button from HeaderHoc
    }))(Kb.HeaderHoc(DestinationPicker))
  : Kb.HeaderOrPopup(DestinationPicker))

const styles = Styles.styleSheetCreate({
  actionRowContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blue5,
    flexShrink: 1,
    height: RowCommon.rowHeight,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  actionText: {
    color: Styles.globalColors.blue,
  },
  anotherHeader: {
    height: 48,
    justifyContent: 'space-between',
    paddingRight: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 480,
      width: 560,
    },
  }),
  desktopHeader: {
    marginBottom: 10,
    marginTop: Styles.globalMargins.medium,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
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
  mobileHeaderButton: {
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
  },
  mobileHeaderContent: {
    flex: 1,
    marginRight: 90, // width of the "Cancel" button
  },
  newFolderBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    padding: Styles.globalMargins.tiny,
  },
  newFolderText: {
    color: Styles.globalColors.blue,
    marginLeft: Styles.globalMargins.tiny,
  },
  rowsContainer: {
    flex: 1,
  },
})

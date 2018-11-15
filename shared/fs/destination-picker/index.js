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
  path: Types.Path,
  routePath: I.List<string>,
  targetName: string,
  targetIconSpec: Types.PathItemIconSpec,
  onCancel: () => void,
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
      <FsCommon.PathItemIcon size={16} spec={props.targetIconSpec} />
      <Kb.Text type="Header" lineClamp={1}>
        {props.targetName}
      </Kb.Text>
      <Kb.Text type="Header" style={{flexShrink: 0}}>
        ”
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.anotherHeader}>
      <Breadcrumb path={props.path} inDestinationPicker={true} routePath={props.routePath} />
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
          color={Styles.globalColors.black_40}
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
        path={props.path}
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
  ? withProps(props => ({
      onCancel: null, // unset this to avoid onCancel button from HeaderHoc
      headerStyle: {paddingRight: 0},
      customComponent: (
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.ClickableBox style={styles.mobileHeaderButton} onClick={props.onCancel}>
            <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
          </Kb.ClickableBox>
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.mobileHeaderContent}>
            <Kb.Box2 direction="horizontal" centerChildren={true} gap="xtiny">
              <FsCommon.PathItemIcon size={12} spec={props.targetIconSpec} />
              <Kb.Text type="BodySmallSemibold" lineClamp={1}>
                {props.targetName}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Text type="Header" lineClamp={1}>
              {Types.getPathName(props.path)}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      ),
      // $FlowFixMe
    }))(Kb.HeaderHoc(DestinationPicker))
  : Kb.HeaderOrPopup(DestinationPicker))

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      width: 560,
      height: 480,
    },
  }),
  desktopHeader: {
    marginTop: Styles.globalMargins.medium,
    marginBottom: 10,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  anotherHeader: {
    height: 48,
    justifyContent: 'space-between',
    paddingRight: Styles.globalMargins.tiny,
  },
  newFolderBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    padding: Styles.globalMargins.tiny,
  },
  newFolderText: {
    marginLeft: Styles.globalMargins.tiny,
    color: Styles.globalColors.blue,
  },
  actionRowContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 1,
    height: RowCommon.rowHeight,
    paddingRight: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.small,
    backgroundColor: Styles.globalColors.blue5,
  },
  actionText: {
    color: Styles.globalColors.blue,
  },
  rowsContainer: {
    flex: 1,
  },
  footer: Styles.platformStyles({
    common: {
      height: 64,
    },
    isElectron: {
      backgroundColor: Styles.globalColors.white_90,
      position: 'absolute',
      bottom: 0,
    },
  }),
  mobileHeaderButton: {
    paddingBottom: 8,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 8,
  },
  mobileHeaderContent: {
    marginRight: 90, // width of the "Cancel" button
    flex: 1,
  },
})

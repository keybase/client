// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Rows from '../row/rows-container'
import * as F from '../common'
import * as R from '../row/common'
import Breadcrumb from '../header/breadcrumb-container.desktop.js'
import {type Props} from '.'

const DestinationPicker = (props: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.header}>
      <Kb.Text type="Header">Move or Copy “</Kb.Text>
      <F.PathItemIcon small={true} style={styles.icon} spec={props.targetIconSpec} />
      <Kb.Text type="Header">{props.targetName}”</Kb.Text>
    </Kb.Box2>
    <Kb.Box style={styles.anotherHeader}>
      <Breadcrumb path={props.path} inDestinationPicker={true} />
      {!!props.onNewFolder && (
        <Kb.ClickableBox style={styles.newFolderBox} onClick={props.onNewFolder}>
          <Kb.Icon type="iconfont-folder-new" color={Styles.globalColors.blue} />
          <Kb.Text type="BodySemibold" style={styles.newFolderText}>
            Create new folder
          </Kb.Text>
        </Kb.ClickableBox>
      )}
    </Kb.Box>
    <Kb.Divider />
    {!!props.onCopyHere && (
      <Kb.ClickableBox style={styles.actionRowContainer} onClick={props.onCopyHere}>
        <Kb.Icon
          type="icon-folder-copy-32"
          color={Styles.globalColors.blue}
          style={R.rowStyles.pathItemIcon}
        />
        <Kb.Text type="BodySemibold" style={styles.actionText}>
          Copy here
        </Kb.Text>
      </Kb.ClickableBox>
    )}
    {!!props.onMoveHere && (
      <Kb.ClickableBox style={styles.actionRowContainer} onClick={props.onMoveHere}>
        <Kb.Icon
          type="icon-folder-move-32"
          color={Styles.globalColors.blue}
          style={R.rowStyles.pathItemIcon}
        />
        <Kb.Text type="BodySemibold" style={styles.actionText}>
          Move here
        </Kb.Text>
      </Kb.ClickableBox>
    )}
    <Kb.Box style={styles.rowsContainer}>
      <Rows path={props.path} sortSetting={Constants.sortByNameAsc} inDestinationPicker={true} />
    </Kb.Box>
    <Kb.Box style={styles.footer}>
      <Kb.Button type="Secondary" label="Cancel" onClick={props.onCancel} />
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
    },
    isElectron: {
      width: 560,
      height: 480,
    },
  }),
  header: {
    marginTop: 32,
    marginBottom: 10,
  },
  anotherHeader: {
    ...Styles.globalStyles.flexBoxRow,
    height: 48,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newFolderBox: {
    ...Styles.globalStyles.flexBoxRow,
    height: 48,
    alignItems: 'center',
    padding: Styles.globalMargins.small,
  },
  newFolderText: {
    marginLeft: Styles.globalMargins.tiny,
    color: Styles.globalColors.blue,
  },
  icon: {
    marginRight: Styles.globalMargins.tiny,
    marginLeft: 2,
  },
  actionRowContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 1,
    height: R.rowHeight,
    paddingRight: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.small,
    backgroundColor: Styles.globalColors.blue5,
  },
  actionText: {
    color: Styles.globalColors.blue,
  },
  rowsContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.fullHeight,
    flex: 1,
  },
  footer: {
    backgroundColor: Styles.globalColors.white_90,
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Styles.globalMargins.small,
    position: 'absolute',
    width: '100%',
    bottom: 0,
  },
})

export default Kb.HeaderOrPopup(DestinationPicker)

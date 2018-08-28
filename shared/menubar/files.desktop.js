// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as FsTypes from '../constants/types/fs'
import PathItemIcon from '../fs/common/path-item-icon'
// TODO: uncomment once we make this.
// import * as RemoteContainer from '../fs/row/remote-container'

type TlfRow = {|
  // TODO: uncomment once we make this.
  // ...$Exact<RemoteContainer.RemoteTlfMeta>,
  path: string,
  onSelectPath: () => void,
  iconSpec: FsTypes.PathItemIconSpec,
  participants: ?Array<string>,
  teamname: ?string,
|}

type FilesPreviewProps = {|
  onViewAll: () => void,
  tlfRows: Array<TlfRow>,
|}

const FileRow = (props: TlfRow) => (
  <Kb.ClickableBox onClick={props.onSelectPath} style={styles.tlfRowContainer}>
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <PathItemIcon spec={props.iconSpec} style={styles.tlfRowAvatar} />
      <Kb.Text type="Body">
        {props.path}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)

export const FilesPreview = ({onViewAll, tlfRows}: FilesPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfContainer}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfSectionHeaderContainer}>
      <Kb.Text type="BodySemibold" style={styles.tlfSectionHeader}>
        Recent files
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {tlfRows.map(r => {
        return <FileRow key={r.path} {...r} />
      })}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonText: {color: Styles.globalColors.black_60},
  tlfContainer: {
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
  },
  tlfSectionHeaderContainer: {
    backgroundColor: Styles.globalColors.white,
  },
  tlfSectionHeader: {
    backgroundColor: Styles.globalColors.black_05,
    color: Styles.globalColors.black_40,
    paddingTop: Styles.globalMargins.xtiny,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
  },
  tlfRowContainer: {
    paddingTop: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.tiny,
  },
  tlfRowAvatar: {
    marginRight: Styles.globalMargins.tiny,
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: 19,
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
})

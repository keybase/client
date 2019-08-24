import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import {namedConnect} from '../../util/container'

type OwnProps = {
  onTriggerFilterMobile: () => void
  path: Types.Path
}

type Props = OwnProps & {
  hasSoftError: boolean
}

const FsNavHeaderRightActions = (props: Props) =>
  !props.hasSoftError ? (
    <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
      <Kbfs.UploadButton path={props.path} style={styles.uploadButton} />
      {Styles.isMobile ? (
        <Kbfs.FolderViewFilterIcon path={props.path} onClick={props.onTriggerFilterMobile} />
      ) : (
        <Kbfs.FolderViewFilter path={props.path} style={styles.folderViewFilter} />
      )}
      <Kbfs.OpenInSystemFileManager path={props.path} />
      <Kbfs.PathItemAction
        path={props.path}
        clickable={{type: 'icon'}}
        initView={Types.PathItemActionMenuView.Root}
        mode="screen"
      />
    </Kb.Box2>
  ) : null

export default namedConnect(
  state => ({_softErrors: state.fs.softErrors}),
  () => ({}),
  (s, _, o: OwnProps) => ({
    ...o,
    hasSoftError: !!Constants.getSoftError(s._softErrors, o.path),
  }),
  'FsNavHeaderRightActions'
)(FsNavHeaderRightActions)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      height: 28,
      // Supposed to be small, but icons already have padding
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  folderViewFilter: {
    marginRight: Styles.globalMargins.tiny,
    width: 140,
  },
  uploadButton: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
    },
  }),
})

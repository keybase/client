// @flow
import * as Types from '../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'

type Props = {|
  onTriggerFilterMobile: () => void,
  path: Types.Path,
|}

const FsNavHeaderRightActions = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
    <Kbfs.UploadButton path={props.path} style={styles.uploadButton} />
    {Styles.isMobile ? (
      <Kbfs.FolderViewFilterIcon path={props.path} onClick={props.onTriggerFilterMobile} />
    ) : (
      <Kbfs.FolderViewFilter path={props.path} style={styles.folderViewFilter} />
    )}
    <Kbfs.OpenInSystemFileManager path={props.path} />
    <Kbfs.PathItemAction path={props.path} clickable={{type: 'icon'}} initView="root" mode="screen" />
  </Kb.Box2>
)

export default FsNavHeaderRightActions

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

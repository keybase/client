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
  <Kb.Box style={styles.outerContainer}>
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
  </Kb.Box>
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
  outerContainer: Styles.platformStyles({
    isElectron: {
      // this extra container make the inner container positioned at top of the
      // 40px space. 39 is because divider is part of this.
      height: 39,
    },
  }),
  uploadButton: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
    },
  }),
})

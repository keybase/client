// @flow
import * as Types from '../../constants/types/fs'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'

type Props = {|
  path: Types.Path,
|}

const FsNavHeaderRightActions = (props: Props) => (
  <Kb.Box style={styles.outerContainer}>
    <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
      <Kbfs.FolderViewFilter path={props.path} gap="tiny" />
      <Kbfs.UploadButton path={props.path} desktopButtonGap="tiny" />
      <Kbfs.NewFolder path={props.path} />
      <Kbfs.SendInAppAction path={props.path} />
      <Kbfs.OpenInSystemFileManager path={props.path} />
      <Kbfs.OpenChat path={props.path} />
      <Kbfs.PathItemAction path={props.path} clickable={{type: 'icon'}} initView="root" />
    </Kb.Box2>
  </Kb.Box>
)

export default FsNavHeaderRightActions

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 28,
      // Supposed to be small, but icons already have padding
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  outerContainer: Styles.platformStyles({
    isElectron: {
      // this extra container make the inner container positioned at top of the
      // 40px space. 39 is because divider is part of this.
      height: 39,
    },
  }),
})

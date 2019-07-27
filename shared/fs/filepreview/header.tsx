import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import {isMobile} from '../../constants/platform'

type HeaderProps = {
  path: Types.Path
  name: string
  onBack: () => void
}

const Header = (props: HeaderProps) => {
  Kbfs.useFsPathMetadata(props.path)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container} gap="xtiny">
      <Kb.BackButton key="back" onClick={props.onBack} style={styles.close} />
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.filePreviewHeader}>
        <Kb.Text center={true} type="BodyBig" selectable={true}>
          {props.name}
        </Kb.Text>
        {!isMobile && <Kbfs.PathItemInfo path={props.path} mode="default" />}
      </Kb.Box2>
      <Kb.Box style={styles.headerIcons}>
        <Kbfs.OpenInSystemFileManager path={props.path} />
        <Kbfs.PathItemAction
          path={props.path}
          clickable={{
            type: 'icon',
          }}
          initView={Types.PathItemActionMenuView.Root}
          mode="screen"
        />
      </Kb.Box>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  close: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),
  container: {minHeight: 48},
  filePreviewHeader: {
    flex: 1,
    flexShrink: 1,
  },
  headerIcons: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginRight: Styles.globalMargins.small,
  },
})

export default Header

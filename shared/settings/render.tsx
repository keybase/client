import * as React from 'react'
import * as Container from '../util/container'
import * as Styles from '../styles'
import SubNav from './sub-nav'
import {Box} from '../common-adapters'
import {SettingsTab} from '../constants/settings'

type Props = {
  children: React.ReactNode
  loadHasRandomPW: () => void
  contactsLabel: string
  onTabChange: (tab: SettingsTab) => void
  selectedTab: SettingsTab
}

const SettingsRender = (props: Props) => {
  const {loadHasRandomPW} = props
  React.useEffect(() => {
    loadHasRandomPW()
  }, [loadHasRandomPW])
  const SettingsNavComponent = (
    <SubNav contactsLabel={props.contactsLabel} selected={props.selectedTab} onClick={props.onTabChange} />
  )
  return Container.isPhone ? (
    SettingsNavComponent
  ) : (
    <Box style={styles.container}>
      <Box style={styles.row}>
        {SettingsNavComponent}
        <Box style={styles.overflowRow}>{props.children}</Box>
      </Box>
    </Box>
  )
}
SettingsRender.navigationOptions = Container.isPhone ? {title: 'More'} : {}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    height: '100%',
  },
  overflowRow: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      flex: 1,
      height: '100%',
    },
    isElectron: {
      overflow: 'auto',
    },
  }),
  row: {
    ...Styles.globalStyles.flexBoxRow,
    flex: 1,
    height: '100%',
  },
}))

export default SettingsRender

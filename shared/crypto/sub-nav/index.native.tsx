import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/crypto'
import NavRow from './nav-row'

const SubNav = () => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="tiny" style={styles.container}>
      {Constants.Tabs.map(t => (
        <NavRow
          key={t.tab}
          tab={t.tab}
          title={t.title}
          illustration={t.illustration}
          description={t.description}
        />
      ))}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Styles.globalColors.blueGrey,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.xsmall,
      },
    } as const)
)

SubNav.navigationOptions = {
  header: undefined,
  title: 'Crypto',
}

export default SubNav

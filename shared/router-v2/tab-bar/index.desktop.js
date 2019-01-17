// @flow
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'

const TabBar = p => (
  <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
    <p>selected tab: {p.selectedTab}</p>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blue,
    flexShrink: 0,
    width: 80,
  },
})

export default TabBar

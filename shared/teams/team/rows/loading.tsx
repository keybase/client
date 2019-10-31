import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export default () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.container} gap="tiny">
    <Kb.ProgressIndicator />
    <Kb.Text type="BodySmall">Loading...</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    padding: Styles.globalMargins.small,
  },
}))

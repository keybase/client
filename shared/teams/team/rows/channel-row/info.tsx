import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export default () => (
  <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.container}>
    <Kb.InfoNote>
      <Kb.Text type="BodySmall" center={true} style={styles.text}>
        Channels can be joined by anyone, unlike subteams.{' '}
      </Kb.Text>
      <Kb.Text type="BodySmall" center={true} style={styles.text}>
        Anyone except readers can create channels.{' '}
      </Kb.Text>
    </Kb.InfoNote>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.large, Styles.globalMargins.medium),
    backgroundColor: Styles.globalColors.blueGrey,
  },
  text: {
    maxWidth: 326,
  },
}))

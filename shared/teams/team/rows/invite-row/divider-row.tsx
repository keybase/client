import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const Divider = ({label}: {label: string}) => (
  <Kb.Box2 alignSelf="flex-start" direction="horizontal" style={styles.container}>
    <Kb.Text style={styles.text} type="BodySmall">
      {label}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, 0),
  },
  text: {color: Styles.globalColors.black_50},
}))

export default Divider

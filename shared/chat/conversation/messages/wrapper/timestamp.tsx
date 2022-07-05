import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {
  timestamp: string
}

const Timestamp = React.memo((props: Props) => (
  <Kb.Box style={styles.box}>
    <Kb.Text style={styles.text} type="BodySmallSemibold">
      {props.timestamp}
    </Kb.Text>
  </Kb.Box>
))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {
        ...Styles.globalStyles.flexBoxCenter,
      },
      text: {
        backgroundColor: Styles.globalColors.fastBlank,
        color: Styles.globalColors.black_50_on_white,
        padding: Styles.globalMargins.tiny,
      },
    } as const)
)
export default Timestamp

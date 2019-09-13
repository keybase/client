import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {
  timestamp: string
}

class Timestamp extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box style={styles.box}>
        <Kb.Text style={styles.text} type="BodySmallSemibold">
          {this.props.timestamp}
        </Kb.Text>
      </Kb.Box>
    )
  }
}

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

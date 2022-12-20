import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

const BigTeamsLabel = () => (
  <Kb.Box style={styles.bigTeamsLabelBox}>
    <Kb.Text type="BodySmallSemibold" style={styles.text}>
      Big teams
    </Kb.Text>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  bigTeamsLabelBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    minHeight: 24,
  },
  text: {backgroundColor: Styles.globalColors.fastBlank},
}))

export {BigTeamsLabel}

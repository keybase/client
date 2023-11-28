import * as Kb from '@/common-adapters'

const BigTeamsLabel = () => (
  <Kb.Box style={styles.bigTeamsLabelBox}>
    <Kb.Text type="BodySmallSemibold" style={styles.text}>
      Big teams
    </Kb.Text>
  </Kb.Box>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  bigTeamsLabelBox: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    minHeight: 24,
  },
  text: {backgroundColor: Kb.Styles.globalColors.fastBlank},
}))

export {BigTeamsLabel}

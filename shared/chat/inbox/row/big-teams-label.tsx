import * as Kb from '@/common-adapters'

const BigTeamsLabel = () => (
  <Kb.Box style={styles.container}>
    <Kb.Box style={styles.bigTeamsLabelBox}>
      <Kb.Text type="BodySmallSemibold" style={styles.text}>
        Big teams
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  bigTeamsLabelBox: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    minHeight: 24,
  },
  container: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: Kb.Styles.isMobile ? 32 : 24,
    marginLeft: Kb.Styles.globalMargins.tiny,
  } as const,
  text: {backgroundColor: Kb.Styles.globalColors.fastBlank},
}))

export {BigTeamsLabel}

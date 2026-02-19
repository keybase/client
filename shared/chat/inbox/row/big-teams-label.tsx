import * as Kb from '@/common-adapters'

const BigTeamsLabel = () => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    alignItems="center"
    style={styles.container}
  >
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.bigTeamsLabelBox}>
      <Kb.Text type="BodySmallSemibold" style={styles.text}>
        Big teams
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  bigTeamsLabelBox: {
    minHeight: 24,
  },
  container: {
    height: Kb.Styles.isMobile ? 32 : 24,
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
  text: {backgroundColor: Kb.Styles.globalColors.fastBlank},
}))

export {BigTeamsLabel}

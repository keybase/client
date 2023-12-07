import * as Kb from '@/common-adapters'

const LoadingRow = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.container} gap="tiny">
    <Kb.ProgressIndicator />
    <Kb.Text type="BodySmall">Loading...</Kb.Text>
  </Kb.Box2>
)
export default LoadingRow

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
}))

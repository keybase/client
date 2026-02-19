import * as Kb from '@/common-adapters'

const LoadingScreen = (p: {why?: string}) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    style={styles.container}
    fullHeight={true}
    fullWidth={true}
    gap="small"
  >
    <Kb.ProgressIndicator type="Large" />
    <Kb.Text type="BodySmall">Loading ...{p.why ?? ''}</Kb.Text>
  </Kb.Box2>
)
export default LoadingScreen

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        ...Kb.Styles.globalStyles.flexGrow,
      },
    }) as const
)

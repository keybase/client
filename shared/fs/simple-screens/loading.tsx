import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const LoadingScreen = () => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    style={styles.container}
    fullHeight={true}
    fullWidth={true}
    gap="small"
  >
    <Kb.ProgressIndicator type="Large" />
    <Kb.Text type="BodySmall">Loading ...</Kb.Text>
  </Kb.Box2>
)
export default LoadingScreen

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Styles.globalColors.blueLighter3,
        ...Styles.globalStyles.flexGrow,
      },
    } as const)
)

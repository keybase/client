import * as Kb from '@/common-adapters'
import {useDelayedShow} from '../common'

const LoadingScreen = (p: {delayMs?: number; why?: string}) => {
  const styles = useStyles()
  const show = useDelayedShow(true, p.delayMs)

  if (!show) {
    return <Kb.Box2 direction="vertical" style={styles.empty} fullHeight={true} fullWidth={true} />
  }
  return (
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
}
export default LoadingScreen

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {
        backgroundColor: theme.blueLighter3,
        ...Kb.Styles.globalStyles.flexGrow,
      },
      empty: Kb.Styles.globalStyles.flexGrow,
    }) as const
)

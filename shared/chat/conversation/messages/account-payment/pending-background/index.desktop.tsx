import * as Styles from '../../../../../styles'
import './pending-background.css'

const patternImage = Styles.backgroundURL('payment-pattern-80.png')

const PendingBackground = () => (
  <div style={styles.container as any}>
    <div className="pendingBackground" style={styles.bg as any} />
  </div>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bg: Styles.platformStyles({
        isElectron: {backgroundImage: patternImage},
      }),
      container: {
        height: '100%',
        overflow: 'hidden',
        position: 'absolute',
        width: '100%',
      },
    } as const)
)

export default PendingBackground

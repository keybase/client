import * as Styles from '../../../../../styles'
import './pending-background.css'
import type {Props} from '.'

const patternImage = Styles.backgroundURL('payment-pattern-80.png')

const PendingBackground = (p: Props) => {
  const {children, style} = p
  return (
    <div style={style as any}>
      <div style={styles.wrap}>
        <div className="pendingBackground" style={styles.bg as any} />
      </div>
      {children}
    </div>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bg: Styles.platformStyles({
        isElectron: {backgroundImage: patternImage},
      }),
      wrap: {
        inset: 0,
        overflow: 'hidden',
        position: 'absolute',
      },
    } as const)
)

export default PendingBackground

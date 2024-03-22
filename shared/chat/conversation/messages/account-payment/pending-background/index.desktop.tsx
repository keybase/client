import './pending-background.css'
import * as Kb from '@/common-adapters'
import type {Props} from '.'
import {backgroundURL} from '@/styles/index.desktop'

const patternImage = backgroundURL('payment-pattern-80.png')

const PendingBackground = (p: Props) => {
  const {children, style} = p
  return (
    <div style={Kb.Styles.castStyleDesktop(style)}>
      <div style={styles.wrap}>
        <div className="pendingBackground" style={Kb.Styles.castStyleDesktop(styles.bg)} />
      </div>
      {children}
    </div>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bg: Kb.Styles.platformStyles({
        isElectron: {backgroundImage: patternImage},
      }),
      wrap: {
        inset: 0,
        overflow: 'hidden',
        position: 'absolute',
      },
    }) as const
)

export default PendingBackground

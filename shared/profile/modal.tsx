import type * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = React.PropsWithChildren<{
  onCancel?: () => void
  skipButton?: boolean
}>

const Modal = ({children, onCancel, skipButton}: Props) => (
  <>
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
      <Kb.ScrollView>
        <Kb.Box2 direction="vertical" flex={1} fullWidth={true} alignItems="center" justifyContent="space-around">
          {children}
        </Kb.Box2>
      </Kb.ScrollView>
      {onCancel && !skipButton && (
        <Kb.Box2 direction="vertical" fullWidth={true} noShrink={true} alignItems="center" style={styles.buttonBar}>
          <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  </>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        padding: isMobile ? undefined : Kb.Styles.globalMargins.medium,
      },
      container: {
        minHeight: isMobile ? undefined : 450,
        padding: isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.medium,
        width: isMobile ? undefined : 560,
      },
    }) as const
)

export default Modal

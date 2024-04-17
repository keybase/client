import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = React.PropsWithChildren<{
  onCancel?: () => void
  skipButton?: boolean
  title?: string
}>

const Modal = ({children, onCancel, skipButton, title}: Props) => (
  <Kb.PopupWrapper onCancel={onCancel} title={title}>
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
      <Kb.ScrollView>
        <Kb.Box2 direction="vertical" style={styles.content} fullWidth={true} alignItems="center">
          {children}
        </Kb.Box2>
      </Kb.ScrollView>
      {onCancel && !skipButton && (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonBar} alignItems="center">
          <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  </Kb.PopupWrapper>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        flexShrink: 0,
        padding: Kb.Styles.isMobile ? undefined : Kb.Styles.globalMargins.medium,
      },
      container: {
        minHeight: Kb.Styles.isMobile ? undefined : 450,
        padding: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.medium,
        width: Kb.Styles.isMobile ? undefined : 560,
      },
      content: {
        flexGrow: 1,
        justifyContent: 'space-around',
      },
    }) as const
)

export default Modal

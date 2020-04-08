import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {CloseType} from '../common-adapters/header-or-popup'

type Props = React.PropsWithChildren<{
  closeType?: CloseType
  onCancel?: () => void
  skipButton?: boolean
}>

const Modal = ({children, onCancel, skipButton, closeType}: Props) => (
  <Kb.PopupDialogDesktop onBack={onCancel} closeType={closeType}>
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="vertical" style={styles.content} fullWidth={true} alignItems="center">
        {children}
      </Kb.Box2>
      {onCancel && !skipButton && (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonBar} alignItems="center">
          <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  </Kb.PopupDialogDesktop>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        flexShrink: 0,
        padding: Styles.isMobile ? undefined : Styles.globalMargins.medium,
      },
      container: {
        minHeight: Styles.isMobile ? undefined : 450,
        padding: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.medium,
        width: Styles.isMobile ? undefined : 560,
      },
      content: {
        flexGrow: 1,
        justifyContent: 'space-around',
      },
    } as const)
)

export default Modal

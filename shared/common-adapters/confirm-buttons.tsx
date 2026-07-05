import Button, {type ButtonProps} from './button'
import ButtonBar from './button-bar'
import WaitingButton from './waiting-button'
import type * as Styles from '@/styles'

const Kb = {
  Button,
  ButtonBar,
  WaitingButton,
}

type Props = {
  cancelLabel?: string
  confirmDisabled?: boolean
  confirmLabel: string
  confirmType?: ButtonProps['type']
  onCancel: () => void
  onConfirm: () => void
  style?: Styles.StylesCrossPlatform
  // either follow keys in the waiting store, or drive directly with a boolean
  waitingKey?: string | Array<string>
  waiting?: boolean
}

/**
 * The standard cancel + confirm footer for form/confirmation screens. Both
 * buttons follow the same waiting state: confirm shows the spinner, cancel
 * just disables. Desktop: row with confirm on the right. Mobile: stacked
 * full width with confirm on top.
 */
const ConfirmButtons = (props: Props) => {
  const cancel = props.waitingKey ? (
    <Kb.WaitingButton
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      waitingKey={props.waitingKey}
      onlyDisable={true}
      fullWidth={isMobile}
    />
  ) : (
    <Kb.Button
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      disabled={props.waiting}
      fullWidth={isMobile}
    />
  )
  const confirm = props.waitingKey ? (
    <Kb.WaitingButton
      key="confirm"
      type={props.confirmType}
      onClick={props.onConfirm}
      label={props.confirmLabel}
      disabled={props.confirmDisabled}
      waitingKey={props.waitingKey}
      fullWidth={isMobile}
    />
  ) : (
    <Kb.Button
      key="confirm"
      type={props.confirmType}
      onClick={props.onConfirm}
      label={props.confirmLabel}
      disabled={props.confirmDisabled}
      waiting={props.waiting}
      fullWidth={isMobile}
    />
  )
  return (
    <Kb.ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile} style={props.style}>
      {isMobile ? confirm : cancel}
      {isMobile ? cancel : confirm}
    </Kb.ButtonBar>
  )
}

export default ConfirmButtons

import Button, {type ButtonProps} from './button'
import ButtonBar from './button-bar'
import WaitingButton from './waiting-button'
import {Box2} from './box'
import * as Styles from '@/styles'

const Kb = {
  Box2,
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
  // modal-footer variant: buttons share the row 50/50
  split?: boolean
  style?: Styles.StylesCrossPlatform
  // either follow keys in the waiting store, or drive directly with a boolean
  waitingKey?: string | Array<string>
  waiting?: boolean
}

/**
 * The standard cancel + confirm footer for form/confirmation screens. Both
 * buttons follow the same waiting state: confirm shows the spinner, cancel
 * just disables. The cancel button is desktop-only: confirm screens are
 * modals, and on mobile the modal header's Cancel is the single cancel
 * affordance. Desktop: row with confirm on the right. Mobile: single full
 * width confirm button.
 */
const ConfirmButtons = (props: Props) => {
  const splitStyle = props.split ? styles.split : undefined
  const cancel = isMobile ? null : props.waitingKey ? (
    <Kb.WaitingButton
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      waitingKey={props.waitingKey}
      onlyDisable={true}
      style={splitStyle}
    />
  ) : (
    <Kb.Button
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      disabled={props.waiting}
      style={splitStyle}
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
      style={splitStyle}
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
      style={splitStyle}
    />
  )
  if (props.split) {
    return (
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} style={props.style}>
        {cancel}
        {confirm}
      </Kb.Box2>
    )
  }
  return (
    <Kb.ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile} style={props.style}>
      {cancel}
      {confirm}
    </Kb.ButtonBar>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  split: {...Styles.globalStyles.flexOne},
}))

export default ConfirmButtons

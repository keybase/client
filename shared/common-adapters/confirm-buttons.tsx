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
  // modal-footer variant: buttons share the row 50/50, cancel is desktop-only
  // (mobile modals close from the header)
  split?: boolean
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
  const splitStyle = props.split ? styles.split : undefined
  const cancel = props.waitingKey ? (
    <Kb.WaitingButton
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      waitingKey={props.waitingKey}
      onlyDisable={true}
      fullWidth={isMobile}
      style={splitStyle}
    />
  ) : (
    <Kb.Button
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      disabled={props.waiting}
      fullWidth={isMobile}
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
        {!isMobile && cancel}
        {confirm}
      </Kb.Box2>
    )
  }
  return (
    <Kb.ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile} style={props.style}>
      {isMobile ? confirm : cancel}
      {isMobile ? cancel : confirm}
    </Kb.ButtonBar>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  split: {...Styles.globalStyles.flexOne},
}))

export default ConfirmButtons

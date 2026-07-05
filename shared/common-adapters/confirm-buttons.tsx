import ButtonBar from './button-bar'
import WaitingButton from './waiting-button'
import type {ButtonProps} from './button'
import type * as Styles from '@/styles'

const Kb = {
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
  waitingKey: string | Array<string>
}

/**
 * The standard cancel + confirm footer for form/confirmation screens. Both
 * buttons follow the same waitingKey: confirm shows the spinner, cancel just
 * disables. Desktop: row with confirm on the right. Mobile: stacked full
 * width with confirm on top.
 */
const ConfirmButtons = (props: Props) => {
  const cancel = (
    <Kb.WaitingButton
      key="cancel"
      type="Dim"
      onClick={props.onCancel}
      label={props.cancelLabel ?? 'Cancel'}
      waitingKey={props.waitingKey}
      onlyDisable={true}
      fullWidth={isMobile}
    />
  )
  const confirm = (
    <Kb.WaitingButton
      key="confirm"
      type={props.confirmType}
      onClick={props.onConfirm}
      label={props.confirmLabel}
      disabled={props.confirmDisabled}
      waitingKey={props.waitingKey}
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

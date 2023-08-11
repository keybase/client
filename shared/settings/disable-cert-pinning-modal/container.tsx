import * as C from '../../constants'
import * as Constants from '../../constants/settings'
import ConfirmDisableCertPinningModal from '.'

export default () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const setDidToggleCertificatePinning = Constants.useState(s => s.dispatch.setDidToggleCertificatePinning)
  const onConfirm = () => {
    setDidToggleCertificatePinning(true)
    navigateUp()
  }
  const props = {
    onCancel,
    onConfirm,
  }
  return <ConfirmDisableCertPinningModal {...props} />
}

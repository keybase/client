import * as C from '@/constants'
import ConfirmDisableCertPinningModal from '.'

const Container = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const setDidToggleCertificatePinning = C.useSettingsState(s => s.dispatch.setDidToggleCertificatePinning)
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

export default Container

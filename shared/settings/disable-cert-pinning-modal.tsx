import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useSettingsState} from '@/stores/settings'

const DisableCertPinningModal = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const setDidToggleCertificatePinning = useSettingsState(s => s.dispatch.setDidToggleCertificatePinning)
  const onConfirm = () => {
    setDidToggleCertificatePinning(true)
    navigateUp()
  }

  return (
    <Kb.ConfirmModal
      confirmText="Yes, I am sure"
      description="This means your proxy or your ISP will be able to view all
        traffic between you and Keybase servers. It is not recommended to use this option unless absolutely required."
      header={<Kb.Icon type="iconfont-exclamation" sizeType="Big" color={Kb.Styles.globalColors.red} />}
      onCancel={onCancel}
      onConfirm={onConfirm}
      prompt="Are you sure you want to allow TLS MITM?"
    />
  )
}

export default DisableCertPinningModal

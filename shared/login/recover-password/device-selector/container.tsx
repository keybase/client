import * as Constants from '../../../constants/recover-password'
import {SelectOtherDevice} from '../../../provision/select-other-device'

const ConnectedDeviceSelector = () => {
  const devices = Constants.useState(s => s.devices)
  const submitDeviceSelect = Constants.useState(s => s.dispatch.submitDeviceSelect)
  const cancel = Constants.useState(s => s.dispatch.cancel)
  const onBack = cancel
  const onResetAccount = () => {
    submitDeviceSelect('')
  }
  const props = {
    devices,
    onBack,
    onResetAccount,
    onSelect: submitDeviceSelect,
    passwordRecovery: true,
  }
  return <SelectOtherDevice {...props} />
}

export default ConnectedDeviceSelector

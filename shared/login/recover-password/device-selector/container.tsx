import * as Constants from '../../../constants/recover-password'
import {SelectOtherDevice} from '../../../provision/select-other-device'

const ConnectedDeviceSelector = () => {
  const devices = Constants.useState(s => s.devices)
  const submitDeviceSelect = Constants.useState(s => s.dispatch.dynamic.submitDeviceSelect)
  const cancel = Constants.useState(s => s.dispatch.dynamic.cancel)
  const onBack = () => {
    cancel?.()
  }
  const onResetAccount = () => {
    submitDeviceSelect?.('')
  }
  const onSelect = (name: string) => {
    if (submitDeviceSelect) {
      submitDeviceSelect(name)
    } else {
      console.log('Missing device select?')
    }
  }
  const props = {
    devices,
    onBack,
    onResetAccount,
    onSelect,
    passwordRecovery: true,
  }
  return <SelectOtherDevice {...props} />
}

export default ConnectedDeviceSelector

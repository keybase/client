import * as Constants from '../../../constants/recover-password'
import {SelectOtherDevice} from '../../../provision/select-other-device'

const ConnectedDeviceSelector = () => {
  const devices = Constants.useState(s => s.devices)
  const submitDeviceSelect = Constants.useState(s => s.dispatch.submitDeviceSelect)
  const cancel = Constants.useState(s => s.dispatch.cancel)
  const _onSelect = submitDeviceSelect
  const onBack = cancel
  const onResetAccount = () => {
    submitDeviceSelect('')
  }
  const props = {
    devices,
    onBack,
    onResetAccount,
    onSelect: (name: string) => {
      const device = devices.find(device => device.name === name)
      _onSelect(device ? device.id : '')
    },
    passwordRecovery: true,
  }
  return <SelectOtherDevice {...props} />
}

export default ConnectedDeviceSelector

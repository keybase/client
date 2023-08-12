import * as C from '../../../constants'
import {SelectOtherDevice} from '../../../provision/select-other-device'

const ConnectedDeviceSelector = () => {
  const devices = C.useRecoverState(s => s.devices)
  const submitDeviceSelect = C.useRecoverState(s => s.dispatch.dynamic.submitDeviceSelect)
  const cancel = C.useRecoverState(s => s.dispatch.dynamic.cancel)
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

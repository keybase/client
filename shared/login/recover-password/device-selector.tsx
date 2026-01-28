import SelectOtherDevice from '@/provision/select-other-device'
import {useState as useRecoverState} from '@/stores/recover-password'

const RecoverPasswordDeviceSelector = () => {
  const devices = useRecoverState(s => s.devices)
  const submitDeviceSelect = useRecoverState(s => s.dispatch.dynamic.submitDeviceSelect)
  const cancel = useRecoverState(s => s.dispatch.dynamic.cancel)
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

export default RecoverPasswordDeviceSelector

import SelectOtherDevice from '@/provision/select-other-device'
import type {Device} from '@/stores/provision'
import {useState as useRecoverState} from '@/stores/recover-password'

type Props = {route: {params: {devices: ReadonlyArray<Device>}}}

const RecoverPasswordDeviceSelector = ({route}: Props) => {
  const {devices} = route.params
  const submitDeviceSelect = useRecoverState(s => s.dispatch.dynamic.submitDeviceSelect)
  const cancel = useRecoverState(s => s.dispatch.dynamic.cancel)
  const onBack = () => {
    cancel?.()
  }
  const onResetAccount = () => {
    submitDeviceSelect?.()
  }
  const onSelect = (name: string) => {
    if (submitDeviceSelect) {
      submitDeviceSelect(devices.find(device => device.name === name)?.id)
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

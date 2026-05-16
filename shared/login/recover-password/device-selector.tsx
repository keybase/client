import SelectOtherDevice from '@/provision/select-other-device'
import type {Device} from '@/stores/provision'
import {
  cancelRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
} from './flow'

type Props = {route: {params: {devices: ReadonlyArray<Device>}}}

const RecoverPasswordDeviceSelector = ({route}: Props) => {
  const {devices} = route.params
  const onBack = () => {
    cancelRecoverPassword()
  }
  const onResetAccount = () => {
    submitRecoverPasswordNoDevice()
  }
  const onSelect = (name: string) => {
    submitRecoverPasswordDeviceSelect(devices.find(device => device.name === name)?.id)
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

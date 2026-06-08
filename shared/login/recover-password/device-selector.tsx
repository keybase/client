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
  return (
    <SelectOtherDevice
      devices={devices}
      onBack={cancelRecoverPassword}
      onResetAccount={submitRecoverPasswordNoDevice}
      onSelect={(name: string) => submitRecoverPasswordDeviceSelect(devices.find(d => d.name === name)?.id)}
      passwordRecovery={true}
    />
  )
}

export default RecoverPasswordDeviceSelector

import SelectOtherDevice from '@/provision/select-other-device'
import type {Device} from '@/constants/provision'
import {
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
} from './flow'

type Props = {route: {params: {devices: ReadonlyArray<Device>}}}

const RecoverPasswordDeviceSelector = ({route}: Props) => {
  const {devices} = route.params
  return (
    <SelectOtherDevice
      devices={devices}
      onResetAccount={submitRecoverPasswordNoDevice}
      onSelect={(name: string) => submitRecoverPasswordDeviceSelect(devices.find(d => d.name === name)?.id)}
      passwordRecovery={true}
    />
  )
}

export default RecoverPasswordDeviceSelector

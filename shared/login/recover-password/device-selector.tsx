import SelectOtherDevice from '@/provision/select-other-device'
import type {Device} from '@/constants/provision'
import {
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
} from './flow'
import {useAnswerRecoverPasswordOnBack} from './use-cancel-on-leave'

type Props = {route: {params: {devices: ReadonlyArray<Device>}}}

const RecoverPasswordDeviceSelector = ({route}: Props) => {
  const {devices} = route.params
  useAnswerRecoverPasswordOnBack()
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

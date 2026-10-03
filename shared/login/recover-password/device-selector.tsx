import SelectOtherDevice from '@/provision/select-other-device'
import type {Device} from '@/constants/provision'
import {
  cancelRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordNoDevice,
} from './flow'
import {useRecoverPromptBack} from './use-prompt-back'

// recoverRunId: the run that showed it, which takes its own screens away when it fails
type Props = {route: {params: {devices: ReadonlyArray<Device>; promptId: number; recoverRunId: string}}}

const RecoverPasswordDeviceSelector = ({route}: Props) => {
  const {devices, promptId} = route.params
  const onBack = () => cancelRecoverPassword(promptId)
  useRecoverPromptBack(promptId, onBack)
  return (
    <SelectOtherDevice
      devices={devices}
      onBack={onBack}
      onResetAccount={() => submitRecoverPasswordNoDevice(promptId)}
      onSelect={(name: string) =>
        submitRecoverPasswordDeviceSelect(promptId, devices.find(d => d.name === name)?.id)
      }
      passwordRecovery={true}
    />
  )
}

export default RecoverPasswordDeviceSelector

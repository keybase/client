import * as C from '@/constants'
import {useSafeSubmit} from '@/util/safe-submit'
import SelectOtherDevice from './select-other-device'
import type {Device} from '@/constants/provision'
import {startAccountReset} from '@/login/reset/account-reset'
import {submitProvisionDeviceSelect} from './flow'

type Props = {
  route: {
    params: {
      devices: ReadonlyArray<Device>
      username: string
    }
  }
}

const SelectOtherDeviceContainer = ({route}: Props) => {
  const {devices, username} = route.params
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const onBack = useSafeSubmit(C.Router2.navigateUp, false)

  const onResetAccount = () => {
    startAccountReset(false, username)
  }

  const onSelect = (name: string) => {
    if (!waiting) submitProvisionDeviceSelect(name)
  }

  return (
    <SelectOtherDevice
      devices={devices}
      onBack={onBack}
      onSelect={onSelect}
      onResetAccount={onResetAccount}
    />
  )
}

export default SelectOtherDeviceContainer

import * as C from '@/constants'
import * as React from 'react'
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
  const [selectedName, setSelectedName] = React.useState('')

  const onResetAccount = () => {
    startAccountReset(false, username)
  }

  const onSelect = (name: string) => {
    // Read waiting at tap time, not render time: the row's onClick closure can outlive a
    // re-render (list rows only refresh on data/extraData change), and the screen mounts
    // inside the window where the throttled waiting decrement hasn't flushed yet.
    const stillWaiting = (C.useWaitingState.getState().counts.get(C.waitingKeyProvision) ?? 0) > 0
    if (!stillWaiting) {
      setSelectedName(name)
      submitProvisionDeviceSelect(name)
    }
  }

  // waitingKeyProvision is flow-global: clear the tap so a later step's waiting can't resurrect a stale row spinner
  React.useEffect(() => {
    if (!waiting) {
      return
    }
    return () => {
      setSelectedName('')
    }
  }, [waiting])

  return (
    <SelectOtherDevice
      devices={devices}
      onBack={onBack}
      onSelect={onSelect}
      onResetAccount={onResetAccount}
      waitingDeviceName={waiting ? selectedName : undefined}
    />
  )
}

export default SelectOtherDeviceContainer

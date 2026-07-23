import * as C from '@/constants'
import * as React from 'react'
import {useIsFocused} from '@react-navigation/core'
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

  // Waiting increments are throttled, so a fast attempt can end without `waiting` ever rendering
  // true and the effect above never arms. Clear the tap when the user navigates back here so the
  // rows can't stay disabled by a stale selection.
  const isFocused = useIsFocused()
  const wasFocusedRef = React.useRef(isFocused)
  React.useEffect(() => {
    if (isFocused && !wasFocusedRef.current) {
      setSelectedName('')
    }
    wasFocusedRef.current = isFocused
  }, [isFocused])

  return (
    <SelectOtherDevice
      devices={devices}
      onBack={onBack}
      onSelect={onSelect}
      onResetAccount={onResetAccount}
      waitingDeviceName={selectedName || undefined}
    />
  )
}

export default SelectOtherDeviceContainer

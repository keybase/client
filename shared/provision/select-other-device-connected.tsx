import * as C from '@/constants'
import * as AutoReset from '@/constants/autoreset'
import * as React from 'react'
import {useSafeSubmit} from '@/util/safe-submit'
import SelectOtherDevice from './select-other-device'

const SelectOtherDeviceContainer = () => {
  const devices = C.useProvisionState(s => s.devices)
  const submitDeviceSelect = C.useProvisionState(s => s.dispatch.dynamic.submitDeviceSelect)
  const username = C.useProvisionState(s => s.username)
  const waiting = C.Waiting.useAnyWaiting(C.Provision.waitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = useSafeSubmit(_onBack, false)
  const startAccountReset = AutoReset.useState(s => s.dispatch.startAccountReset)

  const onResetAccount = React.useCallback(() => {
    startAccountReset(false, username)
  }, [startAccountReset, username])

  const onSelect = React.useCallback(
    (name: string) => {
      if (!waiting) submitDeviceSelect?.(name)
    },
    [submitDeviceSelect, waiting]
  )

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

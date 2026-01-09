import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import {useSafeSubmit} from '@/util/safe-submit'
import SelectOtherDevice from './select-other-device'
import {useProvisionState} from '@/stores/provision'

const SelectOtherDeviceContainer = () => {
  const devices = useProvisionState(s => s.devices)
  const submitDeviceSelect = useProvisionState(s => s.dispatch.dynamic.submitDeviceSelect)
  const username = useProvisionState(s => s.username)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = useSafeSubmit(_onBack, false)
  const startAccountReset = AutoReset.useAutoResetState(s => s.dispatch.startAccountReset)

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

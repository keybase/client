import * as C from '../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
import * as DevicesConstants from '../../constants/devices'
import CodePage2 from '.'

const CodePageContainer = () => {
  const storeDeviceName = C.useCurrentUserState(s => s.deviceName)
  const currentDeviceAlreadyProvisioned = !!storeDeviceName
  // we either have a name for real or we asked on a previous screen
  const provisionDeviceName = C.useProvisionState(s => s.deviceName)
  const currentDeviceName = currentDeviceAlreadyProvisioned ? storeDeviceName : provisionDeviceName
  const deviceID = C.useCurrentUserState(s => s.deviceID)
  const currentDevice = C.useDevicesState(s => s.deviceMap.get(deviceID)) ?? DevicesConstants.emptyDevice
  const error = C.useProvisionState(s => s.error)

  const otherDevice = C.useProvisionState(s => s.codePageOtherDevice)
  const iconNumber = DevicesConstants.useDeviceIconNumber(otherDevice.id)
  const textCode = C.useProvisionState(s => s.codePageIncomingTextCode)
  const waiting = Container.useAnyWaiting(C.provisionWaitingKey)
  const submitTextCode = C.useProvisionState(s => s.dispatch.dynamic.submitTextCode)

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp

  const cancel = C.useProvisionState(s => s.dispatch.dynamic.cancel)
  const onClose = () => cancel?.()
  const onSubmitTextCode = React.useCallback(
    (code: string) => {
      !waiting && submitTextCode?.(code)
    },
    [submitTextCode, waiting]
  )
  return (
    <CodePage2
      error={error}
      currentDevice={currentDevice}
      currentDeviceAlreadyProvisioned={currentDeviceAlreadyProvisioned}
      currentDeviceName={currentDeviceName}
      iconNumber={iconNumber}
      otherDevice={otherDevice}
      textCode={textCode}
      onBack={onBack}
      onClose={onClose}
      onSubmitTextCode={onSubmitTextCode}
      waiting={waiting}
    />
  )
}
export default CodePageContainer

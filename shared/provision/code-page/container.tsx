import * as React from 'react'
import * as C from '../../constants'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import * as DevicesConstants from '../../constants/devices'
import * as ConfigConstants from '../../constants/config'
import CodePage2 from '.'

const CodePageContainer = () => {
  const storeDeviceName = ConfigConstants.useCurrentUserState(s => s.deviceName)
  const currentDeviceAlreadyProvisioned = !!storeDeviceName
  // we either have a name for real or we asked on a previous screen
  const provisionDeviceName = Constants.useState(s => s.deviceName)
  const currentDeviceName = currentDeviceAlreadyProvisioned ? storeDeviceName : provisionDeviceName
  const deviceID = ConfigConstants.useCurrentUserState(s => s.deviceID)
  const currentDevice =
    DevicesConstants.useState(s => s.deviceMap.get(deviceID)) ?? DevicesConstants.emptyDevice
  const error = Constants.useState(s => s.error)

  const otherDevice = Constants.useState(s => s.codePageOtherDevice)
  const iconNumber = DevicesConstants.useDeviceIconNumber(otherDevice.id)
  const textCode = Constants.useState(s => s.codePageIncomingTextCode)
  const waiting = Container.useAnyWaiting(Constants.waitingKey)
  const submitTextCode = Constants.useState(s => s.dispatch.dynamic.submitTextCode)

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp

  const cancel = Constants.useState(s => s.dispatch.dynamic.cancel)
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

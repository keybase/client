import * as React from 'react'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import * as DevicesConstants from '../../constants/devices'
import * as ConfigConstants from '../../constants/config'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CodePage2 from '.'
import HiddenString from '../../util/hidden-string'

const CodePageContainer = () => {
  const storeDeviceName = ConfigConstants.useCurrentUserState(s => s.deviceName)
  const currentDeviceAlreadyProvisioned = !!storeDeviceName
  // we either have a name for real or we asked on a previous screen
  const provisionDeviceName = Container.useSelector(state => state.provision.deviceName)
  const currentDeviceName = currentDeviceAlreadyProvisioned ? storeDeviceName : provisionDeviceName
  const deviceID = ConfigConstants.useCurrentUserState(s => s.deviceID)
  const currentDevice =
    DevicesConstants.useDevicesState(s => s.deviceMap.get(deviceID)) ?? DevicesConstants.emptyDevice
  const error = Constants.useState(s => s.error)

  const otherDevice = Constants.useState(s => s.codePageOtherDevice)
  const iconNumber = DevicesConstants.useDeviceIconNumber(otherDevice.id)
  const textCode = Container.useSelector(state => state.provision.codePageIncomingTextCode.stringValue())
  const waiting = Container.useAnyWaiting(Constants.waitingKey)

  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onClose = React.useCallback(() => dispatch(ProvisionGen.createCancelProvision()), [dispatch])
  const _onSubmitTextCode = React.useCallback(
    (code: string) => {
      !waiting && dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)}))
    },
    [dispatch, waiting]
  )
  const onSubmitTextCode = Container.useSafeSubmit(_onSubmitTextCode, !!error)
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

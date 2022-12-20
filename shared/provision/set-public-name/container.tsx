import * as React from 'react'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as Platform from '../../constants/platform'
import * as Devices from '../../constants/devices'
import * as Container from '../../util/container'
import SetPublicName from '.'

const PublicNameContainer = () => {
  const devices = Container.useSelector(state => state.provision.devices)
  const error = Container.useSelector(state => state.provision.error.stringValue())
  const waiting = Container.useSelector(state => Container.anyWaiting(state, Constants.waitingKey))
  const dispatch = Container.useDispatch()

  const _onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onBack = Container.useSafeSubmit(_onBack, !!error)
  const __onSubmit = React.useCallback(
    (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
    [dispatch]
  )
  const _onSubmit = (name: string) => !waiting && __onSubmit(name)
  const onSubmit = Container.useSafeSubmit(_onSubmit, !!error)

  const deviceNumbers = devices
    .filter(d => d.type === (Platform.isMobile ? 'mobile' : 'desktop'))
    .map(d => d.deviceNumberOfType)
  const maxDeviceNumber = deviceNumbers.length > 0 ? Math.max(...deviceNumbers) : -1
  const deviceIconNumber = ((maxDeviceNumber + 1) % Devices.numBackgrounds) + 1

  return (
    <SetPublicName
      onBack={onBack}
      onSubmit={onSubmit}
      deviceIconNumber={deviceIconNumber}
      error={error}
      waiting={waiting}
    />
  )
}
export default PublicNameContainer

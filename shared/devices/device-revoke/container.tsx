import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Container from '../../util/container'
import * as DevicesGen from '../../actions/devices-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WaitingConstants from '../../constants/waiting'
import DeviceRevoke from '.'
import {HeaderLeftCancel} from '../../common-adapters/header-hoc'
import type * as Types from '../../constants/types/devices'

type OwnProps = Container.RouteProps<'deviceRevoke'>

export const options = {
  headerLeft: p => <HeaderLeftCancel {...p} />,
  title: '',
}

export default (ownProps: OwnProps) => {
  const selectedDeviceID = ownProps.route.params?.deviceID ?? ''
  const _endangeredTLFs = Container.useSelector(state => Constants.getEndangeredTLFs(state, selectedDeviceID))
  const device = Container.useSelector(state => Constants.getDevice(state, selectedDeviceID))
  const iconNumber = Container.useSelector(state => Constants.getDeviceIconNumber(state, selectedDeviceID))
  const waiting = Container.useSelector(state => WaitingConstants.anyWaiting(state, Constants.waitingKey))

  const dispatch = Container.useDispatch()
  const _onSubmit = React.useCallback(
    (deviceID: Types.DeviceID) => dispatch(DevicesGen.createRevoke({deviceID})),
    [dispatch]
  )
  const onCancel = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const props = {
    device,
    endangeredTLFs: [..._endangeredTLFs],
    iconNumber,
    onCancel,
    onSubmit: () => _onSubmit(device.deviceID),
    waiting,
  }
  return <DeviceRevoke {...props} />
}

import * as WaitingConstants from '../../constants/waiting'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import DeviceRevoke from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<{deviceID: string}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const selectedDeviceID = Container.getRouteProps(ownProps, 'deviceID', '')
    return {
      _endangeredTLFs: Constants.getEndangeredTLFs(state, selectedDeviceID),
      device: Constants.getDevice(state, selectedDeviceID),
      iconNumber: Constants.getDeviceIconNumber(state, selectedDeviceID),
      waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
    }
  },
  dispatch => ({
    _onSubmit: (deviceID: Types.DeviceID) => dispatch(DevicesGen.createRevoke({deviceID})),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    device: stateProps.device,
    endangeredTLFs: [...stateProps._endangeredTLFs],
    iconNumber: stateProps.iconNumber,
    onCancel: dispatchProps.onCancel,
    onSubmit: () => dispatchProps._onSubmit(stateProps.device.deviceID),
    waiting: stateProps.waiting,
  })
)(DeviceRevoke)

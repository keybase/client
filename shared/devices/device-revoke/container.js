// @flow
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import * as I from 'immutable'
import DeviceRevoke from './'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const blankDetail = Constants.makeDeviceDetail()

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const deviceID = routeProps.get('deviceID')
  const device = state.devices.idToDetail.get(deviceID, blankDetail)

  return {
    currentDevice: device.currentDevice,
    deviceID,
    endangeredTLFs: state.devices.idToEndangeredTLFs.get(deviceID, I.Set()),
    type: device.type,
    name: device.name,
    waiting: Constants.isWaiting(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onSubmit: () => dispatch(DevicesGen.createDeviceRevoke({deviceID: routeProps.get('deviceID')})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDevice: stateProps.currentDevice,
  deviceID: stateProps.deviceID,
  endangeredTLFs: stateProps.endangeredTLFs.toArray(),
  type: stateProps.type,
  name: stateProps.name,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
  waiting: stateProps.waiting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(DeviceRevoke)

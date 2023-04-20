import * as Container from '../../util/container'
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as DevicesGen from '../../actions/devices-gen'
import type * as Types from '../../constants/types/devices'
import DeviceRow from '.'

type OwnProps = {
  deviceID: Types.DeviceID
  firstItem: boolean
}

export default (ownProps: OwnProps) => {
  const device = Container.useSelector(state => Constants.getDevice(state, ownProps.deviceID))
  const isNew = Container.useSelector(state => state.devices.isNew.has(device.deviceID))

  const stateProps = {
    device,
    isCurrentDevice: device.currentDevice,
    isNew,
    isRevoked: !!device.revokedByName,
    name: device.name,
    type: device.type,
  }

  const dispatch = Container.useDispatch()
  const _showExistingDevicePage = React.useCallback(
    (deviceID: Types.DeviceID) => {
      dispatch(DevicesGen.createShowDevicePage({deviceID}))
    },
    [dispatch]
  )
  const props = {
    device: stateProps.device,
    firstItem: ownProps.firstItem,
    isCurrentDevice: stateProps.isCurrentDevice,
    isNew: stateProps.isNew,
    isRevoked: stateProps.isRevoked,
    name: stateProps.name,
    showExistingDevicePage: () => {
      _showExistingDevicePage(ownProps.deviceID)
    },
    type: stateProps.type,
  }
  return <DeviceRow {...props} />
}

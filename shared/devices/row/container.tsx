// import * as Container from '../../util/container'
// import * as Constants from '../../constants/devices'
// import * as DevicesGen from '../../actions/devices-gen'
// import * as Types from '../../constants/types/devices'
// import DeviceRow from '.'
//
import * as React from 'react'
import * as RR from 'react-redux'
import * as R from 'redux'
import {compose, setDisplayName} from 'recompose'

// import {
   // LogoutHandshakePayload,
   // LogoutHandshakeWaitPayload,
   // LogoutPayload,
   // LoadTeamAvatarsPayload
   // } from '../../actions/config-gen'

// type TypedActions =
  // // | LoadTeamAvatarsPayload
  // | LogoutHandshakePayload
  // | LogoutHandshakeWaitPayload
  // | LogoutPayload

// const a: TypedActions = {
// type: 'config:logoutHandshake',
// payload: {
// version: 3
// }
// }

type Props = {
  name: string
  showExistingDevicePage: () => void
}

const DeviceRow = (p: Props) => <p>{p.name}</p>

namespace Container {
  export type TypedState = {
    config: {
      username: string
    }
  }
  export type TypedDispatch = (a: R.AnyAction) => void
}

namespace Types {
  export type DeviceID = string
}

const Constants = {
  getDevice: (s: Container.TypedState, id: Types.DeviceID) => ({
    name: 'hi' + id + s.config.username,
  }),
}

const connect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  options?: RR.Options<Container.TypedState, TStateProps, TOwnProps, TMergedProps>
) => RR.connect(mapStateToProps, mapDispatchToProps, mergeProps, options)

const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps>,
mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
displayName: string,
options?: RR.Options<Container.TypedState, TStateProps, TOwnProps, TMergedProps>
): RR.InferableComponentEnhancerWithProps<TMergedProps, TOwnProps> =>
// @ts-ignore
compose(
connect(
mapStateToProps,
mapDispatchToProps,
mergeProps,
options
),
setDisplayName(displayName)
)

type OwnProps = {
  deviceID: Types.DeviceID
  firstItem: boolean
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const device = Constants.getDevice(state, ownProps.deviceID)
  return {
    // isCurrentDevice: device.currentDevice,
    // isNew: !!state.devices.getIn(['isNew', device.deviceID]) || false,
    // isRevoked: !!device.revokedByName,
    name: device.name,
    // type: device.type,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, _: OwnProps) => ({
  _showExistingDevicePage: (deviceID: Types.DeviceID) => dispatch({type: 'config:logoutHandshake', payload: {version: 3}}),
  // dispatch(DevicesGen.createShowDevicePage({deviceID})),
})

const C = namedConnect(
// // TODO try named
// const C = connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    // firstItem: ownProps.firstItem,
    // isCurrentDevice: stateProps.isCurrentDevice,
    // isNew: stateProps.isNew,
    // isRevoked: stateProps.isRevoked,
    name: stateProps.name,
    showExistingDevicePage: () => {
      dispatchProps._showExistingDevicePage(ownProps.deviceID)
    },
    // type: stateProps.type,
  }),
  'DeviceRow'
)(DeviceRow)
export default C

const d = <C deviceID="hi'" firstItem={!!3} />
console.log(d)

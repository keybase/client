// @flow
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {navigateAppend} from '../actions/route-tree'

import type {TypedState} from '../constants/reducer'

const makeGetDeviceSelector = (deviceID: string) => (state: TypedState) => (
  state.devices.get('devices').find(d => d.get('deviceID') === deviceID)
)

type OwnProps = {
  deviceID: string,
}

const mapStateToProps = (state: TypedState, {deviceID}: OwnProps) => {
  const selector = createSelector(
    makeGetDeviceSelector(deviceID),
    device => ({device})
  )
  return (state: TypedState) => selector(state)
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  showExistingDevicePage: device => dispatch(navigateAppend([{props: {device}, selected: 'devicePage'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  showExistingDevicePage: () => dispatchProps.showExistingDevicePage(stateProps.device),
})

const RowConnector = connect(mapStateToProps, mapDispatchToProps, mergeProps)

export {
  RowConnector,
}

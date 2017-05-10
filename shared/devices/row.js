// @flow
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'

import type {IconType} from '../common-adapters/icon'
import type {TypedState} from '../constants/reducer'

type OwnProps = {
  deviceID: string,
}

// $FlowIssue no getIn
const makeGetDeviceSelector = (deviceID: string) => (state: TypedState) =>
  state.entities.getIn(['devices', deviceID])

const mapStateToProps = (state: TypedState, {deviceID}: OwnProps) => {
  const selector = createSelector(makeGetDeviceSelector(deviceID), device => {
    const icon: IconType = {
      backup: isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32',
      desktop: isMobile ? 'icon-computer-48' : 'icon-computer-32',
      mobile: isMobile ? 'icon-phone-48' : 'icon-phone-32',
    }[device.type]
    return {
      icon,
      isCurrentDevice: device.currentDevice,
      isRevoked: !!device.revokeBy,
      name: device.name,
    }
  })
  return (state: TypedState) => selector(state)
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  showExistingDevicePage: deviceID =>
    dispatch(navigateAppend([{props: {deviceID}, selected: 'devicePage'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  showExistingDevicePage: () =>
    dispatchProps.showExistingDevicePage(ownProps.deviceID),
})

const RowConnector = connect(mapStateToProps, mapDispatchToProps, mergeProps)

export {RowConnector}

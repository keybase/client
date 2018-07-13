// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import CodePage2 from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const otherDevice = state.provision.selectedDevice
  if (!otherDevice) {
    throw new Error('Code page but no device? Not allowed')
  }

  return {
    currentDeviceAlreadyProvisioned: !!state.config.deviceName,
    currentDeviceName: state.provision.deviceName,
    currentDeviceType: isMobile ? 'mobile' : 'desktop',
    otherDeviceName: otherDevice.name,
    otherDeviceType: otherDevice.type,
    textCode: state.provision.codePageTextCode.stringValue(),
    username: state.config.username || '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmitTextCode: (code: string) =>
    dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  currentDeviceAlreadyProvisioned: stateProps.currentDeviceAlreadyProvisioned,
  currentDeviceName: stateProps.currentDeviceName,
  currentDeviceType: stateProps.currentDeviceType,
  onBack: dispatchProps.onBack,
  onSubmitTextCode: dispatchProps.onSubmitTextCode,
  otherDeviceName: stateProps.otherDeviceName,
  otherDeviceType: stateProps.otherDeviceType,
  textCode: stateProps.textCode,
  username: stateProps.username,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CodePage2)

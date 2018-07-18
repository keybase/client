// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import CodePage2 from '.'
import {compose, connect, type TypedState, type Dispatch, isMobile, safeSubmit} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const currentDeviceAlreadyProvisioned = !!state.config.deviceName
  return {
    currentDeviceAlreadyProvisioned,
    // we either have a name for real or we asked on a previous screen
    currentDeviceName: currentDeviceAlreadyProvisioned ? state.config.deviceName : state.provision.deviceName,
    currentDeviceType: isMobile ? 'mobile' : 'desktop',
    error: state.provision.error.stringValue(),
    otherDeviceName: state.provision.codePageOtherDeviceName,
    otherDeviceType: state.provision.codePageOtherDeviceType,
    textCode: state.provision.codePageTextCode.stringValue(),
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
  error: stateProps.error,
  onBack: dispatchProps.onBack,
  onSubmitTextCode: dispatchProps.onSubmitTextCode,
  otherDeviceName: stateProps.otherDeviceName,
  otherDeviceType: stateProps.otherDeviceType,
  textCode: stateProps.textCode,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  safeSubmit(['onBack', 'onSubmitTextCode'], ['error'])
)(CodePage2)

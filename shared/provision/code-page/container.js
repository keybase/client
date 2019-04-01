// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CodePage2 from '.'
import {compose, connect, isMobile, safeSubmit} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {type RouteProps} from '../../route-tree/render-route'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state, ownProps: OwnProps) => {
  const currentDeviceAlreadyProvisioned = !!state.config.deviceName
  return {
    currentDeviceAlreadyProvisioned,
    // we either have a name for real or we asked on a previous screen
    currentDeviceName:
      (currentDeviceAlreadyProvisioned ? state.config.deviceName : state.provision.deviceName) || '',
    currentDeviceType: isMobile ? 'mobile' : 'desktop',
    error: state.provision.error.stringValue(),
    otherDeviceName: state.provision.codePageOtherDeviceName,
    otherDeviceType: state.provision.codePageOtherDeviceType,
    textCode: state.provision.codePageIncomingTextCode.stringValue(),
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => {
    if (flags.useNewRouter) {
      dispatch(RouteTreeGen.createNavigateUp())
    } else {
      dispatch(ownProps.navigateUp())
    }
  },
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
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  safeSubmit(['onBack', 'onSubmitTextCode'], ['error'])
)(CodePage2)

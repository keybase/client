// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import CodePage2 from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../util/container'
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
    otherDeviceName: state.provision.codePageOtherDeviceName,
    otherDeviceType: state.provision.codePageOtherDeviceType,
    textCode: state.provision.codePageTextCode.stringValue(),
  }
}

let lastSubmitTextCode = ''

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmitTextCode: (code: string) => {
    // Don't keep on submitting the same code. The barcode scanner calls this a bunch of times
    if (lastSubmitTextCode !== code) {
      console.log('aaa submitting text code', code)
      dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)}))
      lastSubmitTextCode = code
    }
  },
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
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CodePage2)

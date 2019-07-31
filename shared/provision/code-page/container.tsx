import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CodePage2 from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'

type OwnProps = {}

export default Container.compose(
  Container.connect(
    state => {
      const currentDeviceAlreadyProvisioned = !!state.config.deviceName
      return {
        currentDeviceAlreadyProvisioned,
        // we either have a name for real or we asked on a previous screen
        currentDeviceName:
          (currentDeviceAlreadyProvisioned ? state.config.deviceName : state.provision.deviceName) || '',
        currentDeviceType: Container.isMobile ? 'mobile' : 'desktop',
        error: state.provision.error.stringValue(),
        otherDeviceName: state.provision.codePageOtherDeviceName,
        otherDeviceType: state.provision.codePageOtherDeviceType,
        textCode: state.provision.codePageIncomingTextCode.stringValue(),
      }
    },
    dispatch => ({
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
      onSubmitTextCode: (code: string) =>
        dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
    }),
    (stateProps, dispatchProps, _: OwnProps) => ({
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
  ),
  Container.safeSubmit(['onBack', 'onSubmitTextCode'], ['error'])
)(CodePage2)

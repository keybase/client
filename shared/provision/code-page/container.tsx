import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CodePage2 from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'

type OwnProps = Container.RouteProps<{}>

export default Container.connect(
  state => {
    const currentDeviceAlreadyProvisioned = !!state.config.deviceName
    return {
      currentDeviceAlreadyProvisioned,
      // we either have a name for real or we asked on a previous screen
      currentDeviceName:
        (currentDeviceAlreadyProvisioned ? state.config.deviceName : state.provision.deviceName) || '',
      error: state.provision.error.stringValue(),
      otherDeviceName: state.provision.codePageOtherDeviceName,
      otherDeviceType: state.provision.codePageOtherDeviceType,
      textCode: state.provision.codePageIncomingTextCode.stringValue(),
    }
  },
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClose: () => dispatch(ProvisionGen.createCancelProvision()),
    onSubmitTextCode: (code: string) =>
      dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    currentDeviceAlreadyProvisioned: stateProps.currentDeviceAlreadyProvisioned,
    currentDeviceName: stateProps.currentDeviceName,
    error: stateProps.error,
    onBack: dispatchProps.onBack,
    onClose: dispatchProps.onClose,
    onSubmitTextCode: dispatchProps.onSubmitTextCode,
    otherDeviceName: stateProps.otherDeviceName,
    otherDeviceType: stateProps.otherDeviceType,
    textCode: stateProps.textCode,
  })
)(Container.safeSubmit(['onBack', 'onSubmitTextCode'], ['error'])(CodePage2))

import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import CodePage2 from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import * as DevicesConstants from '../../constants/devices'
import * as Constants from '../../constants/provision'

type OwnProps = Container.RouteProps<{}>

const prov = Container.connect(
  (state: Container.TypedState) => {
    const currentDeviceAlreadyProvisioned = !!state.config.deviceName
    return {
      currentDeviceAlreadyProvisioned,
      // we either have a name for real or we asked on a previous screen
      currentDeviceName:
        (currentDeviceAlreadyProvisioned ? state.config.deviceName : state.provision.deviceName) || '',
      device: DevicesConstants.getDevice(state, state.config.deviceID),
      error: state.provision.error.stringValue(),
      iconNumber: DevicesConstants.getDeviceIconNumber(state, state.provision.codePageOtherDevice.id),
      otherDevice: state.provision.codePageOtherDevice,
      textCode: state.provision.codePageIncomingTextCode.stringValue(),
      waiting: Container.anyWaiting(state, Constants.waitingKey),
    }
  },
  (dispatch: Container.TypedDispatch) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClose: () => dispatch(ProvisionGen.createCancelProvision()),
    onSubmitTextCode: (code: string) =>
      dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    currentDevice: stateProps.device,
    currentDeviceAlreadyProvisioned: stateProps.currentDeviceAlreadyProvisioned,
    currentDeviceName: stateProps.currentDeviceName,
    error: stateProps.error,
    iconNumber: stateProps.iconNumber,
    onBack: dispatchProps.onBack,
    onClose: dispatchProps.onClose,
    onSubmitTextCode: (code: string) => !stateProps.waiting && dispatchProps.onSubmitTextCode(code),
    otherDevice: stateProps.otherDevice,
    textCode: stateProps.textCode,
    waiting: stateProps.waiting,
  })
)(Container.safeSubmit(['onBack', 'onSubmitTextCode'], ['error'])(CodePage2))
export default prov

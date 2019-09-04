import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import CodePage2, {DeviceType} from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'

type OwnProps = Container.RouteProps<{headerStyle: Styles.StylesCrossPlatform}>

export default Container.connect(
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
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    currentDeviceAlreadyProvisioned: stateProps.currentDeviceAlreadyProvisioned,
    currentDeviceName: stateProps.currentDeviceName,
    currentDeviceType: stateProps.currentDeviceType as DeviceType,
    error: stateProps.error,
    onBack: dispatchProps.onBack,
    onSubmitTextCode: dispatchProps.onSubmitTextCode,
    otherDeviceName: stateProps.otherDeviceName,
    otherDeviceType: stateProps.otherDeviceType,
    setHeaderBackgroundColor: (backgroundColor: string) =>
      ownProps.navigation.setParams({headerStyle: {backgroundColor}}),
    textCode: stateProps.textCode,
  })
)(Container.safeSubmit(['onBack', 'onSubmitTextCode'], ['error'])(CodePage2))

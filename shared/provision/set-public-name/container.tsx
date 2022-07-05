import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as Platform from '../../constants/platform'
import * as Devices from '../../constants/devices'
import SetPublicName from '.'
import * as Container from '../../util/container'

export default Container.connect(
  (state: Container.TypedState) => ({
    devices: state.provision.devices,
    error: state.provision.error.stringValue(),
    waiting: Container.anyWaiting(state, Constants.waitingKey),
  }),
  (dispatch: Container.TypedDispatch) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
  }),
  (stateProps, dispatchProps) => {
    const deviceNumbers = stateProps.devices
      .filter(d => d.type === (Platform.isMobile ? 'mobile' : 'desktop'))
      .map(d => d.deviceNumberOfType)
    const maxDeviceNumber = deviceNumbers.length > 0 ? Math.max(...deviceNumbers) : -1
    return {
      deviceIconNumber: ((maxDeviceNumber + 1) % Devices.numBackgrounds) + 1,
      error: stateProps.error,
      onBack: dispatchProps.onBack,
      onSubmit: (name: string) => !stateProps.waiting && dispatchProps.onSubmit(name),
      waiting: stateProps.waiting,
    }
  }
)(Container.safeSubmit(['onSubmit', 'onBack'], ['error'])(SetPublicName))

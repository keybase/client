import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import DeviceSelector from '../../../provision/select-other-device'

type OwnProps = {}

const ConnectedDeviceSelector = Container.connect(
  state => ({
    devices: state.recoverPassword.devices,
  }),
  dispatch => ({
    _onSelect: (id: string) => dispatch(RecoverPasswordGen.createSubmitDeviceSelect({id})),
    onBack: () => dispatch(RecoverPasswordGen.createAbortDeviceSelect()),
    onResetAccount: () => dispatch(RecoverPasswordGen.createSubmitDeviceSelect({id: ''})),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    onBack: d.onBack,
    onResetAccount: d.onResetAccount,
    onSelect: (name: string) => {
      const device = s.devices.find(device => device.name === name)
      d._onSelect(device ? device.id : '')
    },
    passwordRecovery: true,
  })
)(DeviceSelector)

export default ConnectedDeviceSelector

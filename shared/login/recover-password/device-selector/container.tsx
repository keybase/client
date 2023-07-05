import * as Container from '../../../util/container'
import * as Constants from '../../../constants/provision'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import {SelectOtherDevice} from '../../../provision/select-other-device'

const ConnectedDeviceSelector = () => {
  const devices = Container.useSelector(state => state.recoverPassword.devices)

  const submitDeviceSelect = Constants.useState(s => s.dispatch.submitDeviceSelect)
  const _onSelect = submitDeviceSelect
  const onBack = () => {
    dispatch(RecoverPasswordGen.createAbortDeviceSelect())
  }
  const onResetAccount = () => {
    submitDeviceSelect('')
  }

  const dispatch = Container.useDispatch()
  const props = {
    devices,
    onBack,
    onResetAccount,
    onSelect: (name: string) => {
      const device = devices.find(device => device.name === name)
      _onSelect(device ? device.id : '')
    },
    passwordRecovery: true,
  }
  return <SelectOtherDevice {...props} />
}

export default ConnectedDeviceSelector

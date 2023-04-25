import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import {SelectOtherDevice} from '../../../provision/select-other-device'

const ConnectedDeviceSelector = () => {
  const devices = Container.useSelector(state => state.recoverPassword.devices)
  const _onSelect = (id: string) => {
    dispatch(RecoverPasswordGen.createSubmitDeviceSelect({id}))
  }
  const onBack = () => {
    dispatch(RecoverPasswordGen.createAbortDeviceSelect())
  }
  const onResetAccount = () => {
    dispatch(RecoverPasswordGen.createSubmitDeviceSelect({id: ''}))
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

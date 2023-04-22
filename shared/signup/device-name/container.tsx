import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import * as Constants from '../../constants/signup'
import {anyWaiting} from '../../constants/waiting'
import EnterDevicename from '.'

const ConnectedEnterDevicename = () => {
  const error = Container.useSelector(state => state.signup.devicenameError)
  const initialDevicename = Container.useSelector(state => state.signup.devicename)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.waitingKey))
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(SignupGen.createGoBackAndClearErrors())
  }
  const onContinue = (devicename: string) => {
    dispatch(SignupGen.createCheckDevicename({devicename}))
  }
  const props = {
    error,
    initialDevicename,
    onBack,
    onContinue,
    waiting,
  }
  return <EnterDevicename {...props} />
}

export default ConnectedEnterDevicename

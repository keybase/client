import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/signup'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import EnterUsername from '.'

const ConnectedEnterUsername = () => {
  const error = Container.useSelector(state => state.signup.usernameError)
  const initialUsername = Container.useSelector(state => state.signup.username)
  const usernameTaken = Container.useSelector(state => state.signup.usernameTaken)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.waitingKey))
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(SignupGen.createRestartSignup())
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onContinue = (username: string) => {
    dispatch(SignupGen.createCheckUsername({username}))
  }
  const onLogin = (initUsername: string) => {
    dispatch(ProvisionGen.createStartProvision({initUsername}))
  }
  const props = {
    error,
    initialUsername,
    onBack,
    onContinue,
    onLogin,
    usernameTaken,
    waiting,
  }
  return <EnterUsername {...props} />
}

export default ConnectedEnterUsername

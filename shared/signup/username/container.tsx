import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/signup'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import EnterUsername from '.'

type OwnProps = {}

const ConnectedEnterUsername = Container.connect(
  state => ({
    _users: state.config.configuredAccounts,
    error: state.signup.usernameError,
    initialUsername: state.signup.username,
    usernameTaken: state.signup.usernameTaken,
    waiting: anyWaiting(state, Constants.waitingKey),
  }),
  dispatch => ({
    onBack: () => {
      dispatch(SignupGen.createRestartSignup())
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onContinue: (username: string) => dispatch(SignupGen.createCheckUsername({username})),
    onLogin: (initUsername: string) => dispatch(ProvisionGen.createStartProvision({initUsername})),
  }),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    ...o,
  })
)(EnterUsername)

export default ConnectedEnterUsername

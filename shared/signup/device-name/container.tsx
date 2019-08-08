import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import * as Constants from '../../constants/signup'
import {anyWaiting} from '../../constants/waiting'
import EnterDevicename from '.'

type OwnProps = {}

const ConnectedEnterDevicename = Container.connect(
  state => ({
    error: state.signup.devicenameError,
    initialDevicename: state.signup.devicename,
    waiting: anyWaiting(state, Constants.waitingKey),
  }),
  dispatch => ({
    onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
    onContinue: (devicename: string) => dispatch(SignupGen.createCheckDevicename({devicename})),
  }),
  (d, s, o: OwnProps) => ({
    ...s,
    ...d,
    ...o,
  })
)(EnterDevicename)

export default ConnectedEnterDevicename

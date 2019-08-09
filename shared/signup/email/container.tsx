import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import EnterEmail from '.'

type OwnProps = {}

const ConnectedEnterEmail = Container.connect(
  (state: Container.TypedState) => ({
    allowSearch: false,
    error: state.signup.emailError,
    initialEmail: state.signup.email,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
    onFinish: (email: string, allowSearch: boolean) =>
      dispatch(SignupGen.createCheckEmail({allowSearch, email})),
  }),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    ...o,
  })
)(EnterEmail)

export default ConnectedEnterEmail

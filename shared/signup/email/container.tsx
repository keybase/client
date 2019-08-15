import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EnterEmail from '.'

type OwnProps = {}

const ConnectedEnterEmail = Container.connect(
  (state: Container.TypedState) => ({
    allowSearch: false,
    error: state.signup.emailError,
    initialEmail: state.signup.email,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onFinish: (email: string, searchable: boolean) => {
      dispatch(SettingsGen.createAddEmail({email, searchable}))
      dispatch(SignupGen.createSetJustSignedUpEmail({email}))
      dispatch(RouteTreeGen.createClearModals())
    },
    onSkip: () => {
      dispatch(SignupGen.createSetJustSignedUpEmail({email: 'none'}))
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    ...o,
  })
)(EnterEmail)

export default ConnectedEnterEmail

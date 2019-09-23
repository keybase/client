import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import ResetPassword from '.'

type OwnProps = {}

const ConnectedResetPassword = Container.connect(
  _ => ({}),
  dispatch => ({
    onContinue: (action: boolean) => dispatch(RecoverPasswordGen.createSubmitResetPrompt({action})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(ResetPassword)

export default ConnectedResetPassword

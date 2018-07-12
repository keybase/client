// @flow
import * as LoginGen from '../../../actions/login-gen'
import * as Constants from '../../../constants/login'
import UsernameOrEmail from '.'
import {connect, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  error: state.login.error,
  // So we can clear the error if the name is changed
  submittedUsernameOrEmail: state.login.provisionUsernameOrEmail,
  waitingForResponse: state.waiting.get(Constants.waitingKey),
})

const dispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  onSubmit: (usernameOrEmail: string) => dispatch(LoginGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default connect(mapStateToProps, dispatchToProps)(UsernameOrEmail)

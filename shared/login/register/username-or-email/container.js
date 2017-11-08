// @flow
import * as LoginGen from '../../../actions/login-gen'
import UsernameOrEmail from '.'
import {connect, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  waitingForResponse: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const dispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  onSubmit: (usernameOrEmail: string) => dispatch(LoginGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default connect(mapStateToProps, dispatchToProps)(UsernameOrEmail)

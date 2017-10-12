// @flow
import UsernameOrEmail from '.'
import {connect, type TypedState} from '../../../util/container'
import * as Creators from '../../../actions/login/creators'

const mapStateToProps = (state: TypedState) => ({
  waitingForResponse: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const dispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: (usernameOrEmail: string) => dispatch(Creators.submitUsernameOrEmail(usernameOrEmail)),
})

export default connect(mapStateToProps, dispatchToProps)(UsernameOrEmail)

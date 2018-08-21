// @flow
import * as SignupGen from '../../../actions/signup-gen'
import RequestInviteSuccess from '.'
import {connect} from '../../../util/container'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o}))(
  RequestInviteSuccess
)

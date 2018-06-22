// @flow
import * as SignupGen from '../../../actions/signup-gen'
import RequestInviteSuccess from '.'
import {connect} from '../../../util/container'

const mapStateToProps = state => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect(mapStateToProps, mapDispatchToProps)(RequestInviteSuccess)

// @flow
import * as SignupGen from '../../../actions/signup-gen'
import RequestInviteSuccess from '.'
import {connect} from '../../../util/container'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch) => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RequestInviteSuccess)

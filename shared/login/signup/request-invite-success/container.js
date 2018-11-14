// @flow
import * as SignupGen from '../../../actions/signup-gen'
import RequestInviteSuccess from '.'
import {connect} from '../../../util/container'

type OwnProps = {||}

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createRestartSignup()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RequestInviteSuccess)

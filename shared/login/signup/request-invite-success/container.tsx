import * as SignupGen from '../../../actions/signup-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import RequestInviteSuccess from '.'
import {connect} from '../../../util/container'

type OwnProps = {}

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onBack: () => {
    dispatch(SignupGen.createRestartSignup())
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RequestInviteSuccess)

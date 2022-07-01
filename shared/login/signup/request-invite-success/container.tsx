import * as SignupGen from '../../../actions/signup-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import RequestInviteSuccess from '.'
import {connect} from '../../../util/container'

type OwnProps = {}

export default connect(
  () => ({}),
  dispatch => ({
    onBack: () => {
      dispatch(SignupGen.createRestartSignup())
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(RequestInviteSuccess)

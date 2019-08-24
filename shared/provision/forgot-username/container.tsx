import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ForgotUsername from '.'
import {connect} from '../../util/container'

type OwnProps = {}

export default connect(
  state => ({forgotUsernameResult: state.provision.forgotUsernameResult}),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (email: string) => dispatch(ProvisionGen.createForgotUsername({email})),
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(ForgotUsername)

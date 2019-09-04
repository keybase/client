import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import ForgotUsername from '.'
import {connect} from '../../util/container'
import * as Container from '../../util/container'

type OwnProps = {}

export default connect(
  state => ({
    forgotUsernameResult: state.provision.forgotUsernameResult,
    waiting: Container.anyWaiting(state, Constants.forgotUsernameWaitingKey),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (email: string, phone: string) => dispatch(ProvisionGen.createForgotUsername({email, phone})),
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(ForgotUsername)

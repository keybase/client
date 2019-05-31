import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ForgotUsername from '.'
import {connect} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  forgotUsernameResult: state.provision.forgotUsernameResult,
})

const dispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (email: string) => dispatch(ProvisionGen.createForgotUsername({email})),
})

export default connect(
  mapStateToProps,
  dispatchToProps,
  (s, d, _) => ({...s, ...d})
)(ForgotUsername)

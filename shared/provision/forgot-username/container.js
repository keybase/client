// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import ForgotUsername from '.'
import {connect} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  forgotUsernameResult: state.provision.forgotUsernameResult,
})

const dispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onSubmit: (email: string) => dispatch(ProvisionGen.createForgotUsername({email})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  dispatchToProps,
  (s, d, _) => ({...s, ...d})
)(ForgotUsername)

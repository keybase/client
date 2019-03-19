// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import UsernameOrEmail from '.'
import {compose, connect, safeSubmit} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import {constantsStatusCode} from '../../constants/types/rpc-gen'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  badUsernameError:
    !!state.provision.inlineError && state.provision.inlineError.code === constantsStatusCode.scnotfound,
  error: state.provision.error.stringValue(),
  // So we can clear the error if the name is changed
  submittedUsername: state.provision.username,
})

const dispatchToProps = (dispatch, {navigateAppend, navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onForgotUsername: () => dispatch(navigateAppend([{props: {}, selected: 'forgotUsername'}])),
  onGoToSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSubmit: (usernameOrEmail: string) =>
    dispatch(ProvisionGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    dispatchToProps,
    (s, d, _) => ({...s, ...d})
  ),
  safeSubmit(['onBack', 'onSubmit'], ['error', 'badUsernameError'])
)(UsernameOrEmail)

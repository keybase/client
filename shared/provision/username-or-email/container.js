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
  submittedUsernameOrEmail: state.provision.usernameOrEmail,
})

const dispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onGoToSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSubmit: (usernameOrEmail: string) =>
    dispatch(ProvisionGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    dispatchToProps,
    (stateProps, dispatchProps, _) => ({
      badUsernameError: stateProps.badUsernameError,
      error: stateProps.error,
      onBack: dispatchProps.onBack,
      onGoToSignup: dispatchProps.onGoToSignup,
      onSubmit: dispatchProps.onSubmit,
      submittedUsernameOrEmail: stateProps.submittedUsernameOrEmail,
    })
  ),
  safeSubmit(['onBack', 'onSubmit'], ['error', 'badUsernameError'])
)(UsernameOrEmail)

// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import Username from '.'
import {compose, connect, safeSubmit} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  inlineError: state.provision.inlineError ? state.provision.inlineError.code : null,
  // So we can clear the error if the name is changed
  submittedUsername: state.provision.username,
})

const dispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onForgotUsername: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'forgotUsername'}]})),
  onGoToSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSubmit: (username: string) => dispatch(ProvisionGen.createSubmitUsername({username})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    dispatchToProps,
    (s, d, _) => ({...s, ...d})
  ),
  safeSubmit(['onBack', 'onSubmit'], ['error', 'inlineError'])
)(Username)

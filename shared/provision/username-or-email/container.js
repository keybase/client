// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import Username from '.'
import {compose, connect, safeSubmit} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import * as Constants from '../../constants/provision'

type OwnProps = RouteProps<{}, {}>

const mapInlineErrorToProps = state => {
  let inlineError = state.provision.inlineError
  if (inlineError) {
    // If it's a "not found" error, we will show "go to signup" link,
    // otherwise just the error.
    if (Constants.errorNotFound(inlineError.code)) {
      return {
        inlineError: "This username doesn't exist.",
        inlineSignUpLink: true,
      }
    } else if (Constants.errorBadUsername(inlineError.code)) {
      return {
        inlineError: 'This username is not valid.',
        inlineSignUpLink: false,
      }
    }
  }
  return {}
}

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  // So we can clear the error if the name is changed
  submittedUsername: state.provision.username,
  ...mapInlineErrorToProps(state),
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

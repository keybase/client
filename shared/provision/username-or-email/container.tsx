import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import Username from '.'
import {compose, connect, safeSubmit} from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'
import * as RPCTypes from '../../constants/types/rpc-gen'

type OwnProps = RouteProps<{}, {}>

const decodeInlineError = inlineRPCError => {
  let inlineError = ''
  let inlineSignUpLink = false
  if (inlineRPCError) {
    switch (inlineRPCError.code) {
      case RPCTypes.constantsStatusCode.scnotfound:
        // If it's a "not found" error, we will show "go to signup" link,
        // otherwise just the error.
        inlineError = "This username doesn't exist."
        inlineSignUpLink = true
        break
      case RPCTypes.constantsStatusCode.scbadusername:
        inlineError = 'This username is not valid.'
        inlineSignUpLink = false
        break
    }
  }
  return {inlineError, inlineSignUpLink}
}

const mapStateToProps = state => {
  const {inlineError, inlineSignUpLink} = decodeInlineError(state.provision.inlineError)
  return {
    error: state.provision.error.stringValue(),
    inlineError,
    inlineSignUpLink,
    // So we can clear the error if the name is changed
    submittedUsername: state.provision.username,
  }
}

const dispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onForgotUsername: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'forgotUsername'}]})),
  onGoToSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSubmit: (username: string) => dispatch(ProvisionGen.createSubmitUsername({username})),
})

export default compose(
  // @ts-ignore codemode issue
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    dispatchToProps,
    (s, d, _) => ({...s, ...d})
  ),
  safeSubmit(['onBack', 'onSubmit'], ['error', 'inlineError'])
)(Username)

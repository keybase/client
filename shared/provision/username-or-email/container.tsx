import * as Container from '../../util/container'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import Username from '.'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {usernameHint} from '../../constants/signup'

type OwnProps = {}

const decodeInlineError = inlineRPCError => {
  let inlineError = ''
  let inlineSignUpLink = false
  if (inlineRPCError) {
    switch (inlineRPCError.code) {
      case RPCTypes.StatusCode.scnotfound:
        // If it's a "not found" error, we will show "go to signup" link,
        // otherwise just the error.
        inlineError = "This username doesn't exist."
        inlineSignUpLink = true
        break
      case RPCTypes.StatusCode.scbadusername:
        inlineError = usernameHint
        inlineSignUpLink = false
        break
    }
  }
  return {inlineError, inlineSignUpLink}
}

const mapStateToProps = (state: Container.TypedState) => {
  const {inlineError, inlineSignUpLink} = decodeInlineError(state.provision.inlineError)
  return {
    error: state.provision.error.stringValue(),
    initialUsername: state.provision.initialUsername,
    inlineError,
    inlineSignUpLink,
    // So we can clear the error if the name is changed
    submittedUsername: state.provision.username,
  }
}

const dispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onForgotUsername: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'forgotUsername'}]})),
  onGoToSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSubmit: (username: string) => dispatch(ProvisionGen.createSubmitUsername({username})),
})

export default Container.compose(
  Container.connect(mapStateToProps, dispatchToProps, (s, d, _: OwnProps) => ({...s, ...d})),
  Container.safeSubmit(['onBack', 'onSubmit'], ['error', 'inlineError'])
)(Username)

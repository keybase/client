import * as Container from '../../util/container'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as Constants from '../../constants/provision'
import Username from '.'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {usernameHint} from '../../constants/signup'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{fromReset: boolean}>

const decodeInlineError = inlineRPCError => {
  let inlineError = ''
  let inlineSignUpLink = false
  if (inlineRPCError) {
    switch (inlineRPCError.code) {
      case RPCTypes.StatusCode.scnotfound:
        // If it's a "not found" error, we will show "go to signup" link,
        // otherwise just the error.
        inlineError = ''
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

export default Container.compose(
  Container.connect(
    state => {
      const error = state.provision.error.stringValue()
      const {inlineError, inlineSignUpLink} = decodeInlineError(state.provision.inlineError)
      return {
        _resetBannerUser: state.autoreset.username,
        error: error ? error : inlineError && !inlineSignUpLink ? inlineError : '',
        initialUsername: state.provision.initialUsername,
        inlineError,
        inlineSignUpLink,
        // So we can clear the error if the name is changed
        submittedUsername: state.provision.username,
        waiting: anyWaiting(state, Constants.waitingKey),
      }
    },
    dispatch => ({
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
      onForgotUsername: () =>
        dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'forgotUsername'}]})),
      onGoToSignup: (username: string) => dispatch(SignupGen.createRequestAutoInvite({username})),
      onSubmit: (username: string) => dispatch(ProvisionGen.createSubmitUsername({username})),
    }),
    (s, d, o: OwnProps) => ({
      ...d,
      error: s.error,
      initialUsername: s.initialUsername,
      inlineError: s.inlineError,
      inlineSignUpLink: s.inlineSignUpLink,
      onSubmit: (username: string) => !s.waiting && d.onSubmit(username),
      resetBannerUser: Container.getRouteProps(o, 'fromReset', false) ? s._resetBannerUser : null,
      submittedUsername: s.submittedUsername,
      waiting: s.waiting,
    })
  ),
  Container.safeSubmit(['onBack', 'onSubmit'], ['error', 'inlineError', 'inlineSignUpLink'])
)(Username)

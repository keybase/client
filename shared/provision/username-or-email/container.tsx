import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import Username from '.'
import {anyWaiting} from '../../constants/waiting'
import {usernameHint} from '../../constants/signup'
import type {RPCError} from '../../util/errors'

type OwnProps = Container.RouteProps<'username'>

const decodeInlineError = (inlineRPCError: RPCError | undefined) => {
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

const UsernameOrEmailContainer = (op: OwnProps) => {
  const _error = Container.useSelector(state => state.provision.error.stringValue())
  const {inlineError, inlineSignUpLink} = Container.useSelector(state =>
    decodeInlineError(state.provision.inlineError)
  )
  const _resetBannerUser = Container.useSelector(state => state.autoreset.username)
  const error = _error ? _error : inlineError && !inlineSignUpLink ? inlineError : ''
  const initialUsername = Container.useSelector(state => state.provision.initialUsername)
  // So we can clear the error if the name is changed
  const submittedUsername = Container.useSelector(state => state.provision.username)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.waitingKey))
  const hasError = !!error || !!inlineError || inlineSignUpLink

  const dispatch = Container.useDispatch()
  const _onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onBack = Container.useSafeSubmit(_onBack, hasError)
  const onForgotUsername = React.useCallback(
    () => dispatch(RouteTreeGen.createNavigateAppend({path: ['forgotUsername']})),
    [dispatch]
  )
  const onGoToSignup = React.useCallback(
    (username: string) => dispatch(SignupGen.createRequestAutoInvite({username})),
    [dispatch]
  )
  const _onSubmit = React.useCallback(
    (username: string) => {
      !waiting && dispatch(ProvisionGen.createSubmitUsername({username}))
    },
    [dispatch, waiting]
  )
  const onSubmit = Container.useSafeSubmit(_onSubmit, hasError)

  const resetBannerUser = op.route.params?.fromReset ? _resetBannerUser : null

  return (
    <Username
      error={error}
      initialUsername={initialUsername}
      inlineError={inlineError}
      inlineSignUpLink={inlineSignUpLink}
      onBack={onBack}
      onForgotUsername={onForgotUsername}
      onGoToSignup={onGoToSignup}
      onSubmit={onSubmit}
      resetBannerUser={resetBannerUser}
      submittedUsername={submittedUsername}
      waiting={waiting}
    />
  )
}
export default UsernameOrEmailContainer

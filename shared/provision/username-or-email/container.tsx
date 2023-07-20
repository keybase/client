import * as ARConstants from '../../constants/autoreset'
import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupConstants from '../../constants/signup'
import Username from '.'
import shallowEqual from 'shallowequal'
import type {RPCError} from '../../util/errors'

type OwnProps = {fromReset?: boolean}

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
        inlineError = SignupConstants.usernameHint
        inlineSignUpLink = false
        break
    }
  }
  return {inlineError, inlineSignUpLink}
}

const UsernameOrEmailContainer = (op: OwnProps) => {
  const _resetBannerUser = ARConstants.useState(s => s.username)
  const resetBannerUser = op.fromReset ? _resetBannerUser : undefined
  const _error = Constants.useState(s => s.error)
  const {inlineError, inlineSignUpLink} = Constants.useState(
    s => decodeInlineError(s.inlineError),
    shallowEqual
  )
  const error = _error ? _error : inlineError && !inlineSignUpLink ? inlineError : ''
  // So we can clear the error if the name is changed
  const username = Constants.useState(s => s.username)
  const waiting = Container.useAnyWaiting(Constants.waitingKey)
  const hasError = !!error || !!inlineError || inlineSignUpLink

  const dispatch = Container.useDispatch()
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = Container.useSafeSubmit(_onBack, hasError)
  const onForgotUsername = React.useCallback(
    () => dispatch(RouteTreeGen.createNavigateAppend({path: ['forgotUsername']})),
    [dispatch]
  )
  const requestAutoInvite = SignupConstants.useState(s => s.dispatch.requestAutoInvite)
  const onGoToSignup = requestAutoInvite
  const setUsername = Constants.useState(s => s.dispatch.dynamic.setUsername)
  const onSubmit = React.useCallback(
    (username: string) => {
      !waiting && setUsername?.(username)
    },
    [setUsername, waiting]
  )
  return (
    <Username
      error={error}
      initialUsername={username}
      inlineError={inlineError}
      inlineSignUpLink={inlineSignUpLink}
      onBack={onBack}
      onForgotUsername={onForgotUsername}
      onGoToSignup={onGoToSignup}
      onSubmit={onSubmit}
      resetBannerUser={resetBannerUser}
      waiting={waiting}
    />
  )
}
export default UsernameOrEmailContainer

import * as C from '../../constants'
import * as Container from '../../util/container'
import * as T from '../../constants/types'
import * as React from 'react'
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
      case T.RPCGen.StatusCode.scnotfound:
        // If it's a "not found" error, we will show "go to signup" link,
        // otherwise just the error.
        inlineError = ''
        inlineSignUpLink = true
        break
      case T.RPCGen.StatusCode.scbadusername:
        inlineError = SignupConstants.usernameHint
        inlineSignUpLink = false
        break
    }
  }
  return {inlineError, inlineSignUpLink}
}

const UsernameOrEmailContainer = (op: OwnProps) => {
  const _resetBannerUser = C.useAutoResetState(s => s.username)
  const resetBannerUser = op.fromReset ? _resetBannerUser : undefined
  const _error = C.useProvisionState(s => s.error)
  const {inlineError, inlineSignUpLink} = C.useProvisionState(
    s => decodeInlineError(s.inlineError),
    shallowEqual
  )
  const error = _error ? _error : inlineError && !inlineSignUpLink ? inlineError : ''
  // So we can clear the error if the name is changed
  const username = C.useProvisionState(s => s.username)
  const waiting = Container.useAnyWaiting(C.provisionWaitingKey)
  const hasError = !!error || !!inlineError || inlineSignUpLink

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = Container.useSafeSubmit(_onBack, hasError)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onForgotUsername = React.useCallback(() => navigateAppend('forgotUsername'), [navigateAppend])
  const requestAutoInvite = C.useSignupState(s => s.dispatch.requestAutoInvite)
  const onGoToSignup = requestAutoInvite
  const setUsername = C.useProvisionState(s => s.dispatch.dynamic.setUsername)
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

import {RPCError} from '../../util/errors'

export type State = Readonly<{
  // TODO remove
  forgotPasswordError?: Error
  forgotPasswordSubmitting: boolean
  forgotPasswordSuccess: boolean
  // shared by all errors, we only ever want one error
  error?: RPCError
  registerUserPassLoading: boolean
  isOnline?: boolean
}>

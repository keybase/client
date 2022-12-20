import type {RPCError} from '../../util/errors'

export type State = {
  // TODO remove
  readonly forgotPasswordError?: Error
  readonly forgotPasswordSubmitting: boolean
  readonly forgotPasswordSuccess: boolean
  // shared by all errors, we only ever want one error
  readonly error?: RPCError
  readonly registerUserPassLoading: boolean
  readonly isOnline?: boolean
}

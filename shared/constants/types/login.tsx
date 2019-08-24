import * as I from 'immutable'
import {RPCError} from '../../util/errors'

export type _State = {
  // TODO remove
  forgotPasswordError: Error | null
  forgotPasswordSubmitting: boolean
  forgotPasswordSuccess: boolean
  // shared by all errors, we only ever want one error
  error: RPCError | null
  registerUserPassLoading: boolean
  isOnline: boolean | null
}

export type State = I.RecordOf<_State>

import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'

export type _State = {
  // TODO remove
  forgotPasswordError: Error | null
  forgotPasswordSubmitting: boolean
  forgotPasswordSuccess: boolean
  // shared by all errors, we only ever want one error
  error: HiddenString
  registerUserPassLoading: boolean
}

export type State = I.RecordOf<_State>
